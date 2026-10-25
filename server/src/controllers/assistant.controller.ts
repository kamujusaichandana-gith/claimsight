import type { RequestHandler } from 'express'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../lib/app-error.js'
import { prisma } from '../lib/prisma.js'
import { createGeminiEmbeddingProvider } from '../services/gemini-embedding-provider.js'
import { createGeminiAssistantProvider } from '../services/gemini-assistant-provider.js'
import { retrievePolicyChunks, type RetrievedPolicyChunk } from '../services/policy-knowledge-base.js'
import { generatePolicyAnswer } from '../services/policy-assistant.service.js'

const askSchema = z.object({
  policyId: z.string().trim().min(1),
  question: z.string().trim().min(3).max(500),
}).strict()

const policyQuerySchema = z.object({
  policyId: z.string().trim().min(1),
}).strict()

function userIdFrom(request: Parameters<RequestHandler>[0]): string {
  if (!request.user || request.user.role !== UserRole.CUSTOMER) {
    throw new AppError(401, 'Authentication required')
  }
  return request.user.id
}

function assistantEnabled(): boolean {
  return process.env.LLM_ENABLED?.trim().toLowerCase() === 'true'
}

function configuredLimit(name: string, defaultValue: number): number {
  const value = process.env[name] === undefined ? defaultValue : Number(process.env[name])
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AppError(500, 'Assistant usage limits are not configured correctly')
  }
  return value
}

async function reserveAssistantCall(userId: string): Promise<void> {
  const userLimit = configuredLimit('ASSISTANT_USER_RATE_LIMIT', 10)
  const dailyLimit = configuredLimit('ASSISTANT_DAILY_CALL_CAP', 100)

  await prisma.$transaction(async (transaction) => {
    const userReservation = await transaction.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "AssistantUserUsage" ("userId", "hour", "count")
      VALUES (${userId}, date_trunc('hour', CURRENT_TIMESTAMP), 1)
      ON CONFLICT ("userId", "hour") DO UPDATE
      SET "count" = "AssistantUserUsage"."count" + 1
      WHERE "AssistantUserUsage"."count" < ${userLimit}
      RETURNING "count"
    `
    if (userReservation.length === 0) {
      throw new AppError(429, 'You have reached your hourly assistant limit. Please try again later.')
    }

    const dailyReservation = await transaction.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "AssistantDailyUsage" ("day", "count")
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT ("day") DO UPDATE
      SET "count" = "AssistantDailyUsage"."count" + 1
      WHERE "AssistantDailyUsage"."count" < ${dailyLimit}
      RETURNING "count"
    `
    if (dailyReservation.length === 0) {
      throw new AppError(429, 'The policy assistant is busy today. Please try again tomorrow.')
    }
  })
}

function requestPolicyId(request: Parameters<RequestHandler>[0]): string {
  const parsed = policyQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw parsed.error
  }
  return parsed.data.policyId
}

async function requireOwnedPolicy(policyId: string, userId: string) {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, userId },
    select: { id: true },
  })
  if (!policy) {
    throw new AppError(404, 'Policy not found')
  }
}

export const getHistory: RequestHandler = async (request, response) => {
  const userId = userIdFrom(request)
  const policyId = requestPolicyId(request)
  await requireOwnedPolicy(policyId, userId)
  const messages = await prisma.chatMessage.findMany({
    where: { userId, policyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
  })
  response.status(200).json({ items: messages.reverse() })
}

export const clearHistory: RequestHandler = async (request, response) => {
  const userId = userIdFrom(request)
  const policyId = requestPolicyId(request)
  await requireOwnedPolicy(policyId, userId)
  await prisma.chatMessage.deleteMany({ where: { userId, policyId } })
  response.status(204).end()
}

function sendEvent(response: Parameters<RequestHandler>[1], event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export const ask: RequestHandler = async (request, response) => {
  const input = askSchema.parse(request.body)
  const userId = userIdFrom(request)
  const policy = await prisma.policy.findFirst({
    where: { id: input.policyId, userId },
    select: { id: true, type: true },
  })
  if (!policy) {
    throw new AppError(404, 'Policy not found')
  }
  if (!assistantEnabled()) {
    throw new AppError(503, 'The policy assistant is unavailable right now.')
  }

  await reserveAssistantCall(userId)

  let embeddingProvider: ReturnType<typeof createGeminiEmbeddingProvider>
  try {
    embeddingProvider = createGeminiEmbeddingProvider()
  } catch {
    throw new AppError(503, 'The policy assistant is unavailable right now.')
  }

  let chunks: RetrievedPolicyChunk[]
  try {
    const topK = configuredLimit('RAG_TOP_K', 4)
    const minimumSimilarity = Number(process.env.RAG_MIN_SIMILARITY ?? '0.5')
    if (!Number.isFinite(minimumSimilarity) || minimumSimilarity < -1 || minimumSimilarity > 1) {
      throw new Error('Invalid retrieval threshold')
    }
    chunks = await retrievePolicyChunks(
      prisma,
      embeddingProvider,
      policy.type,
      input.question,
      topK,
      minimumSimilarity,
    )
  } catch {
    throw new AppError(502, 'Policy documents could not be searched right now. Please try again.')
  }

  let assistantProvider: ReturnType<typeof createGeminiAssistantProvider> | undefined
  if (chunks.length > 0) {
    try {
      assistantProvider = createGeminiAssistantProvider()
    } catch {
      throw new AppError(503, 'The policy assistant is unavailable right now.')
    }
  }

  const abortController = new AbortController()
  response.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  response.status(200).flushHeaders()

  let clientDisconnected = false
  response.on('close', () => {
    if (!response.writableEnded) {
      clientDisconnected = true
      abortController.abort()
    }
  })

  try {
    const result = await generatePolicyAnswer(
      input.question,
      chunks,
      assistantProvider,
      abortController.signal,
      (text) => {
        if (!clientDisconnected) sendEvent(response, 'delta', { text })
      },
    )
    if (clientDisconnected) return

    const sources: Prisma.InputJsonArray = result.sources.map((source) => ({
      documentTitle: source.documentTitle,
      sectionTitle: source.sectionTitle,
      excerpt: source.excerpt,
    }))
    const answerCreatedAt = new Date()
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          userId,
          policyId: policy.id,
          role: 'USER',
          content: input.question,
          createdAt: new Date(answerCreatedAt.getTime() - 1),
        },
      }),
      prisma.chatMessage.create({
        data: {
          userId,
          policyId: policy.id,
          role: 'ASSISTANT',
          content: result.answer,
          sources,
          createdAt: answerCreatedAt,
        },
      }),
    ])
    sendEvent(response, 'done', { sources: result.sources })
    response.end()
  } catch (error) {
    if (clientDisconnected) return
    if (error instanceof AppError) {
      sendEvent(response, 'error', {
        status: error.statusCode,
        message: error.message,
      })
    } else {
      sendEvent(response, 'error', {
        status: 500,
        message: 'The policy assistant could not save this answer. Please try again.',
      })
    }
    response.end()
  }
}
