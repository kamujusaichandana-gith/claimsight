import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import type { RequestHandler } from 'express'
import type { Prisma } from '@prisma/client'
import { ClaimStatus, PolicyStatus } from '@prisma/client'
import { AppError } from '../lib/app-error.js'
import { prisma } from '../lib/prisma.js'
import type {
  CreateClaimInput,
  ListClaimsQuery,
} from '../validators/customer.validator.js'
import { listClaimsQuerySchema } from '../validators/customer.validator.js'

function authenticatedUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) {
    throw new AppError(401, 'Authentication required')
  }

  return request.user.id
}

function requiredPathId(request: Parameters<RequestHandler>[0]): string {
  const id = request.params.id
  if (typeof id !== 'string') {
    throw new AppError(404, 'Resource not found')
  }

  return id
}

export const listPolicies: RequestHandler = async (request, response) => {
  const items = await prisma.policy.findMany({
    where: { userId: authenticatedUserId(request) },
    orderBy: { startDate: 'desc' },
  })

  response.status(200).json({ items })
}

export const getPolicy: RequestHandler = async (request, response) => {
  const policy = await prisma.policy.findFirst({
    where: {
      id: requiredPathId(request),
      userId: authenticatedUserId(request),
    },
  })

  if (!policy) {
    throw new AppError(404, 'Policy not found')
  }

  response.status(200).json({ policy })
}

export const createClaim: RequestHandler = async (request, response) => {
  const userId = authenticatedUserId(request)
  const input = request.body as CreateClaimInput
  const policy = await prisma.policy.findFirst({
    where: { id: input.policyId, userId, status: PolicyStatus.ACTIVE },
    select: { id: true },
  })

  if (!policy) {
    throw new AppError(404, 'Active policy not found')
  }

  const claim = await prisma.$transaction(async (transaction) => {
    const createdClaim = await transaction.claim.create({
      data: {
        claimNumber: `CLM-${randomUUID().toUpperCase()}`,
        policyId: policy.id,
        userId,
        incidentDate: input.incidentDate,
        incidentType: input.incidentType,
        description: input.description,
        amount: input.amount,
        status: ClaimStatus.SUBMITTED,
      },
    })

    await transaction.claimStatusHistory.create({
      data: {
        claimId: createdClaim.id,
        fromStatus: null,
        toStatus: ClaimStatus.SUBMITTED,
        changedById: userId,
      },
    })

    return createdClaim
  })

  response.status(201).json({ claim })
}

export const listClaims: RequestHandler = async (request, response) => {
  const query = listClaimsQuerySchema.parse(request.query) as ListClaimsQuery
  const userId = authenticatedUserId(request)
  const where: Prisma.ClaimWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { claimNumber: { contains: query.search, mode: 'insensitive' } },
            { incidentType: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const orderBy = {
    [query.sortBy]: query.order,
  } satisfies Prisma.ClaimOrderByWithRelationInput
  const skip = (query.page - 1) * query.limit

  const [items, total] = await Promise.all([
    prisma.claim.findMany({ where, orderBy, skip, take: query.limit }),
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
  const claim = await prisma.claim.findFirst({
    where: {
      id: requiredPathId(request),
      userId: authenticatedUserId(request),
    },
    include: {
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

export const ensureOwnedClaim: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const claim = await prisma.claim.findFirst({
    where: {
      id: requiredPathId(request),
      userId: authenticatedUserId(request),
    },
    select: { id: true },
  })

  if (!claim) {
    throw new AppError(404, 'Claim not found')
  }

  next()
}

export const createClaimDocument: RequestHandler = async (
  request,
  response,
) => {
  const file = request.file
  if (!file) {
    throw new AppError(400, 'A document file is required')
  }

  try {
    const document = await prisma.claimDocument.create({
      data: {
        claimId: requiredPathId(request),
        fileName: file.filename,
        filePath: `uploads/${file.filename}`,
      },
    })

    response.status(201).json({ document })
  } catch (error) {
    await unlink(file.path).catch(() => undefined)
    throw error
  }
}
