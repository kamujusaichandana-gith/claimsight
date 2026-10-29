import type { RequestHandler } from 'express'
import type { Prisma } from '@prisma/client'
import { ClaimStatus } from '@prisma/client'
import { z } from 'zod'
import { claimSummarySchema, summarizeClaim } from '../services/claim-summary.service.js'
import type { ClaimSummaryProvider } from '../services/claim-summary.service.js'
import { getAiProviderFactories } from '../lib/ai-provider-factories.js'
import { AppError } from '../lib/app-error.js'
import { prisma } from '../lib/prisma.js'
import {
  createAdminClaimCommentSchema,
  listAdminClaimsQuerySchema,
  updateClaimStatusSchema,
} from '../validators/admin.validator.js'

const summaryRequestSchema = z.object({
  regenerate: z.boolean().optional().default(false),
}).strict().default({})

function summarizerEnabled(): boolean {
  return process.env.LLM_ENABLED?.trim().toLowerCase() === 'true'
}

function dailyCallCap(): number {
  const rawCap = process.env.LLM_DAILY_CALL_CAP
  const cap = rawCap === undefined ? 100 : Number(rawCap)
  if (!Number.isSafeInteger(cap) || cap < 1) {
    throw new AppError(500, 'AI summary daily call cap is not configured correctly')
  }
  return cap
}

async function reserveDailySummaryCall(): Promise<void> {
  const reservations = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "ClaimSummaryUsage" ("day", "count")
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT ("day") DO UPDATE
    SET "count" = "ClaimSummaryUsage"."count" + 1
    WHERE "ClaimSummaryUsage"."count" < ${dailyCallCap()}
    RETURNING "count"
  `
  if (reservations.length === 0) {
    throw new AppError(429, 'The daily AI summary limit has been reached. Please try again tomorrow.')
  }
}

function authenticatedUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) {
    throw new AppError(401, 'Authentication required')
  }

  return request.user.id
}

function requiredPathId(request: Parameters<RequestHandler>[0]): string {
  const id = request.params.id
  if (typeof id !== 'string') {
    throw new AppError(404, 'Claim not found')
  }

  return id
}

const allowedTransitions: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  [ClaimStatus.SUBMITTED]: [ClaimStatus.UNDER_REVIEW],
  [ClaimStatus.UNDER_REVIEW]: [ClaimStatus.APPROVED, ClaimStatus.REJECTED],
  [ClaimStatus.APPROVED]: [ClaimStatus.PAID],
}

export const listClaims: RequestHandler = async (request, response) => {
  const query = listAdminClaimsQuerySchema.parse(request.query)
  const where: Prisma.ClaimWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.policyType ? { policy: { type: query.policyType } } : {}),
    ...(query.search
      ? {
          OR: [
            { claimNumber: { contains: query.search, mode: 'insensitive' } },
            {
              user: {
                name: { contains: query.search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  }
  const orderBy = {
    [query.sortBy]: query.order,
  } satisfies Prisma.ClaimOrderByWithRelationInput
  const skip = (query.page - 1) * query.limit

  const [items, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
      include: {
        policy: { select: { policyNumber: true, type: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.claim.count({ where }),
  ])

  response.status(200).json({
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  })
}

export const getClaim: RequestHandler = async (request, response) => {
  const claim = await prisma.claim.findUnique({
    where: { id: requiredPathId(request) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      policy: { select: { policyNumber: true, type: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true } } },
      },
      documents: { orderBy: { uploadedAt: 'asc' } },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
  })

  if (!claim) {
    throw new AppError(404, 'Claim not found')
  }

  response.status(200).json({ claim })
}

export const getClaimSummary: RequestHandler = async (request, response) => {
  const claim = await prisma.claim.findUnique({
    where: { id: requiredPathId(request) },
    select: {
      summary: true,
      summaryGeneratedAt: true,
      summaryModel: true,
    },
  })
  if (!claim) {
    throw new AppError(404, 'Claim not found')
  }

  const summary = claim.summary === null
    ? null
    : claimSummarySchema.safeParse(claim.summary)
  if (summary && !summary.success) {
    throw new AppError(500, 'The stored AI summary is invalid')
  }

  response.status(200).json({
    enabled: summarizerEnabled(),
    summary: summary?.success ? summary.data : null,
    generatedAt: claim.summaryGeneratedAt,
    model: claim.summaryModel,
  })
}

export const createClaimSummary: RequestHandler = async (request, response) => {
  const input = summaryRequestSchema.parse(request.body)
  if (!summarizerEnabled()) {
    throw new AppError(503, 'AI summaries are disabled')
  }

  const claim = await prisma.claim.findUnique({
    where: { id: requiredPathId(request) },
    include: {
      policy: { select: { policyNumber: true, type: true } },
      comments: {
        select: { message: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!claim) {
    throw new AppError(404, 'Claim not found')
  }

  if (claim.summary !== null && !input.regenerate) {
    const cachedSummary = claimSummarySchema.safeParse(claim.summary)
    if (!cachedSummary.success) {
      throw new AppError(500, 'The stored AI summary is invalid')
    }
    response.status(200).json(cachedSummary.data)
    return
  }

  let provider: ClaimSummaryProvider
  try {
    provider = getAiProviderFactories().summary()
  } catch {
    throw new AppError(503, 'AI summary provider is not configured')
  }

  const summary = await summarizeClaim(
    {
      claimNumber: claim.claimNumber,
      incidentDate: claim.incidentDate.toISOString(),
      incidentType: claim.incidentType,
      description: claim.description,
      amount: claim.amount.toString(),
      policy: claim.policy,
      comments: claim.comments.map((comment) => ({
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
      })),
    },
    provider,
    reserveDailySummaryCall,
  )

  await prisma.claim.update({
    where: { id: claim.id },
    data: {
      summary,
      summaryGeneratedAt: new Date(),
      summaryModel: process.env.LLM_MODEL?.trim() ?? null,
    },
  })
  response.status(200).json(summary)
}

export const updateClaimStatus: RequestHandler = async (
  request,
  response,
) => {
  const input = updateClaimStatusSchema.parse(request.body)
  const claimId = requiredPathId(request)
  const changedById = authenticatedUserId(request)

  const updatedClaim = await prisma.$transaction(async (transaction) => {
    const claim = await transaction.claim.findUnique({
      where: { id: claimId },
      select: { id: true, status: true },
    })

    if (!claim) {
      throw new AppError(404, 'Claim not found')
    }

    if (!allowedTransitions[claim.status]?.includes(input.status)) {
      throw new AppError(400, 'Invalid claim status transition')
    }

    const update = await transaction.claim.updateMany({
      where: { id: claim.id, status: claim.status },
      data: { status: input.status },
    })

    if (update.count !== 1) {
      throw new AppError(400, 'Invalid claim status transition')
    }

    await transaction.claimStatusHistory.create({
      data: {
        claimId: claim.id,
        fromStatus: claim.status,
        toStatus: input.status,
        changedById,
      },
    })

    return transaction.claim.findUniqueOrThrow({ where: { id: claim.id } })
  })

  response.status(200).json({ claim: updatedClaim })
}

export const createClaimComment: RequestHandler = async (
  request,
  response,
) => {
  const input = createAdminClaimCommentSchema.parse(request.body)
  const claimId = requiredPathId(request)
  const authorId = authenticatedUserId(request)

  const exists = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true },
  })

  if (!exists) {
    throw new AppError(404, 'Claim not found')
  }

  const comment = await prisma.claimComment.create({
    data: { claimId, authorId, message: input.message },
    include: { author: { select: { id: true, name: true } } },
  })

  response.status(201).json({ comment })
}

export const getStats: RequestHandler = async (_request, response) => {
  const now = new Date()
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  )
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )

  const [statusCounts, monthlyCounts] = await Promise.all([
    prisma.claim.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ month: Date; count: number }[]>`
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::int AS count
      FROM "Claim"
      WHERE "createdAt" >= ${firstMonth} AND "createdAt" < ${nextMonth}
      GROUP BY date_trunc('month', "createdAt")
      ORDER BY month ASC
    `,
  ])

  const countByStatus = new Map(
    statusCounts.map(({ status, _count }) => [status, _count._all]),
  )
  const countByMonth = new Map(
    monthlyCounts.map(({ month, count }) => [
      `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`,
      count,
    ]),
  )
  const claimsPerMonth = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(
      Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1),
    )
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
    return { month: key, count: countByMonth.get(key) ?? 0 }
  })

  response.status(200).json({
    claimsByStatus: Object.values(ClaimStatus).map((status) => ({
      status,
      count: countByStatus.get(status) ?? 0,
    })),
    claimsPerMonth,
  })
}
