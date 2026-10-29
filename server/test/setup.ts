import 'dotenv/config'
import { afterEach, beforeEach } from 'vitest'
import { unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSafeTestDatabaseUrl } from './database-safety.js'

process.env.DATABASE_URL = assertSafeTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
)
process.env.JWT_SECRET ??= 'test-only-jwt-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.LLM_ENABLED = 'false'
process.env.LLM_ADMIN_RATE_LIMIT = '5'
process.env.LLM_DAILY_CALL_CAP = '100'
process.env.ASSISTANT_USER_RATE_LIMIT = '10'
process.env.ASSISTANT_DAILY_CALL_CAP = '100'

const { prisma } = await import('../src/lib/prisma.js')
const uploadDirectory = fileURLToPath(
  new URL('../uploads/', import.meta.url),
)

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ClaimComment", "ClaimDocument", "ClaimStatusHistory", "ChatMessage", "AssistantUserUsage", "AssistantDailyUsage", "ClaimSummaryUsage", "Claim", "Policy", "PolicyDocumentChunk", "User" RESTART IDENTITY CASCADE`,
  )
})

afterEach(async () => {
  const documents = await prisma.claimDocument.findMany({
    select: { filePath: true },
  })
  for (const document of documents) {
    try {
      await unlink(join(uploadDirectory, basename(document.filePath)))
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
  }
})
