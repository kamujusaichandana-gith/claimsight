import 'dotenv/config'
import { PolicyType } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'
import { createGeminiEmbeddingProvider } from '../src/services/gemini-embedding-provider.js'
import { retrievePolicyChunks } from '../src/services/policy-knowledge-base.js'

function getPositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

async function main(): Promise<void> {
  const [policyTypeInput, ...questionParts] = process.argv.slice(2)
  const policyType = Object.values(PolicyType).find((value) => value === policyTypeInput)
  const question = questionParts.join(' ').trim()

  if (!policyType || !question) {
    throw new Error(
      'Usage: npm run rag:query -- <AUTO|HOME|HEALTH|TRAVEL> "<question>"',
    )
  }

  const topK = getPositiveInteger('RAG_TOP_K', process.env.RAG_TOP_K, 4)
  const minimumSimilarity = Number(process.env.RAG_MIN_SIMILARITY ?? '0.5')
  const results = await retrievePolicyChunks(
    prisma,
    createGeminiEmbeddingProvider(),
    policyType,
    question,
    topK,
    minimumSimilarity,
  )

  if (results.length === 0) {
    console.log('No policy chunks met the similarity threshold.')
    return
  }
  for (const result of results) {
    console.log(
      `\n[${result.similarity.toFixed(4)}] ${result.documentTitle} — ${result.sectionTitle}\n` +
      result.content,
    )
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      `Policy knowledge base query failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
