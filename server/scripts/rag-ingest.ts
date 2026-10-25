import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PolicyType } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'
import { createGeminiEmbeddingProvider } from '../src/services/gemini-embedding-provider.js'
import {
  chunkPolicyMarkdown,
  ingestPolicyChunks,
} from '../src/services/policy-knowledge-base.js'

const policyFiles = [
  { policyType: PolicyType.AUTO, fileName: 'auto.md' },
  { policyType: PolicyType.HOME, fileName: 'home.md' },
  { policyType: PolicyType.HEALTH, fileName: 'health.md' },
  { policyType: PolicyType.TRAVEL, fileName: 'travel.md' },
] as const

async function main(): Promise<void> {
  const policyChunks = await Promise.all(
    policyFiles.map(async ({ policyType, fileName }) => {
      const markdown = await readFile(resolve(process.cwd(), 'data/policies', fileName), 'utf8')
      return chunkPolicyMarkdown(markdown, policyType)
    }),
  )
  const summary = await ingestPolicyChunks(
    prisma,
    policyChunks.flat(),
    createGeminiEmbeddingProvider(),
  )
  console.log(
    `Policy knowledge base ingestion complete: ${summary.created} created, ` +
    `${summary.updated} updated, ${summary.skipped} skipped, ${summary.deleted} deleted.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(
      `Policy knowledge base ingestion failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
