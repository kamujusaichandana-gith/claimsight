import { createHash, randomUUID } from 'node:crypto'
import { Prisma, PrismaClient, PolicyType } from '@prisma/client'
import type { EmbeddingProvider } from './gemini-embedding-provider.js'

export interface PolicyChunk {
  id: string
  policyType: PolicyType
  documentTitle: string
  sectionTitle: string
  content: string
  contentHash: string
}

export interface RetrievedPolicyChunk {
  documentTitle: string
  sectionTitle: string
  content: string
  similarity: number
}

interface ExistingPolicyChunk {
  id: string
  policyType: PolicyType
  sectionTitle: string
  contentHash: string
}

const chunkWordLimit = 350
const chunkOverlapWords = 35

function normalizeParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = []
  let currentLines: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      if (currentLines.length > 0) {
        paragraphs.push(currentLines.join(' '))
        currentLines = []
      }
      continue
    }
    currentLines.push(line.trim())
  }

  if (currentLines.length > 0) {
    paragraphs.push(currentLines.join(' '))
  }
  return paragraphs
}

function splitLongSection(content: string): string[] {
  const words = content.split('\n\n').flatMap((paragraph, paragraphIndex) =>
    paragraph.split(/\s+/).map((word) => ({ word, paragraphIndex })),
  )
  if (words.length <= chunkWordLimit) {
    return [content]
  }

  const chunkCount = Math.ceil(
    (words.length - chunkOverlapWords) / (chunkWordLimit - chunkOverlapWords),
  )
  const chunkSize = Math.ceil(
    (words.length + chunkOverlapWords * (chunkCount - 1)) / chunkCount,
  )
  const step = chunkSize - chunkOverlapWords
  const chunks: string[] = []

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * step
    const chunkWords = words.slice(start, start + chunkSize)
    let chunkContent = ''
    let previousParagraphIndex = chunkWords[0].paragraphIndex
    for (const [wordIndex, { word, paragraphIndex }] of chunkWords.entries()) {
      if (wordIndex > 0) {
        chunkContent += paragraphIndex === previousParagraphIndex ? ' ' : '\n\n'
      }
      chunkContent += word
      previousParagraphIndex = paragraphIndex
    }
    chunks.push(chunkContent)
  }
  return chunks
}

export function chunkPolicyMarkdown(markdown: string, policyType: PolicyType): PolicyChunk[] {
  const lines = markdown.split(/\r?\n/)
  const titleLineIndex = lines.findIndex((line) => /^#\s+\S/.test(line))
  if (titleLineIndex < 0) {
    throw new Error(`${policyType} policy document is missing a title`)
  }

  const documentTitle = lines[titleLineIndex].replace(/^#\s+/, '').trim()
  const sections: Array<{ title: string; lines: string[] }> = []
  let currentSection: { title: string; lines: string[] } | undefined

  for (const line of lines.slice(titleLineIndex + 1)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      currentSection = { title: heading[1].trim(), lines: [] }
      sections.push(currentSection)
    } else if (currentSection) {
      currentSection.lines.push(line)
    } else if (line.trim()) {
      throw new Error(`${policyType} policy document has content before its first section`)
    }
  }

  if (sections.length === 0) {
    throw new Error(`${policyType} policy document has no sections`)
  }

  return sections.flatMap(({ title: sectionTitle, lines: sectionLines }) => {
    const content = normalizeParagraphs(sectionLines).join('\n\n')
    if (!content) {
      throw new Error(`${policyType} policy section "${sectionTitle}" is empty`)
    }

    return splitLongSection(content).map((chunkContent) => {
      const contentHash = createHash('sha256')
        .update(`policy-chunk-v2\n${policyType}\n${documentTitle}\n${sectionTitle}\n${chunkContent}`)
        .digest('hex')
      return {
        id: randomUUID(),
        policyType,
        documentTitle,
        sectionTitle,
        content: chunkContent,
        contentHash,
      }
    })
  })
}

function embeddingText(chunk: Pick<PolicyChunk, 'documentTitle' | 'sectionTitle' | 'content'>) {
  return `Document: ${chunk.documentTitle}\nSection: ${chunk.sectionTitle}\n${chunk.content}`
}

function vectorParameter(embedding: number[]): string {
  if (embedding.length !== 768 || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding dimensions do not match vector(768)')
  }
  return `[${embedding.join(',')}]`
}

export async function ingestPolicyChunks(
  prisma: PrismaClient,
  chunks: PolicyChunk[],
  embeddingProvider: EmbeddingProvider,
): Promise<{ created: number; updated: number; skipped: number; deleted: number }> {
  const policyTypes = [...new Set(chunks.map((chunk) => chunk.policyType))]
  const existingChunks = await prisma.$queryRaw<ExistingPolicyChunk[]>`
    SELECT "id", "policyType", "sectionTitle", "contentHash"
    FROM "PolicyDocumentChunk"
    WHERE "policyType" IN (${Prisma.join(policyTypes.map((type) => Prisma.sql`${type}::"PolicyType"`))})
  `

  const currentKeys = new Set(
    chunks.map(({ policyType, sectionTitle, contentHash }) =>
      `${policyType}\u0000${sectionTitle}\u0000${contentHash}`,
    ),
  )
  const existingByKey = new Map(
    existingChunks.map((chunk) => [
      `${chunk.policyType}\u0000${chunk.sectionTitle}\u0000${chunk.contentHash}`,
      chunk,
    ]),
  )
  const existingBySection = new Set(
    existingChunks.map(({ policyType, sectionTitle }) => `${policyType}\u0000${sectionTitle}`),
  )
  const counts = { created: 0, updated: 0, skipped: 0, deleted: 0 }

  for (const chunk of chunks) {
    const key = `${chunk.policyType}\u0000${chunk.sectionTitle}\u0000${chunk.contentHash}`
    if (existingByKey.has(key)) {
      counts.skipped += 1
      continue
    }

    const embedding = await embeddingProvider.embed(embeddingText(chunk), 'RETRIEVAL_DOCUMENT')
    const vector = vectorParameter(embedding)
    await prisma.$executeRaw`
      INSERT INTO "PolicyDocumentChunk" (
        "id", "policyType", "documentTitle", "sectionTitle", "content",
        "contentHash", "embedding", "createdAt", "updatedAt"
      ) VALUES (
        ${chunk.id}, ${chunk.policyType}::"PolicyType", ${chunk.documentTitle},
        ${chunk.sectionTitle}, ${chunk.content}, ${chunk.contentHash},
        ${vector}::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("policyType", "sectionTitle", "contentHash")
      DO UPDATE SET
        "documentTitle" = EXCLUDED."documentTitle",
        "content" = EXCLUDED."content",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = CURRENT_TIMESTAMP
    `

    if (existingBySection.has(`${chunk.policyType}\u0000${chunk.sectionTitle}`)) {
      counts.updated += 1
    } else {
      counts.created += 1
    }
  }

  const staleIds = existingChunks
    .filter((chunk) =>
      !currentKeys.has(`${chunk.policyType}\u0000${chunk.sectionTitle}\u0000${chunk.contentHash}`),
    )
    .map(({ id }) => id)
  if (staleIds.length > 0) {
    counts.deleted = await prisma.$executeRaw`
      DELETE FROM "PolicyDocumentChunk" WHERE "id" IN (${Prisma.join(staleIds)})
    `
  }

  return counts
}

export async function retrievePolicyChunks(
  prisma: PrismaClient,
  embeddingProvider: EmbeddingProvider,
  policyType: PolicyType,
  question: string,
  topK: number,
  minimumSimilarity: number,
): Promise<RetrievedPolicyChunk[]> {
  if (!Number.isInteger(topK) || topK < 1) {
    throw new Error('RAG_TOP_K must be a positive integer')
  }
  if (!Number.isFinite(minimumSimilarity) || minimumSimilarity < -1 || minimumSimilarity > 1) {
    throw new Error('RAG_MIN_SIMILARITY must be between -1 and 1')
  }

  const embedding = await embeddingProvider.embed(question, 'RETRIEVAL_QUERY')
  const vector = vectorParameter(embedding)
  return prisma.$queryRaw<RetrievedPolicyChunk[]>`
    SELECT
      "documentTitle",
      "sectionTitle",
      "content",
      1 - ("embedding" <=> ${vector}::vector) AS "similarity"
    FROM "PolicyDocumentChunk"
    WHERE "policyType" = ${policyType}::"PolicyType"
      AND 1 - ("embedding" <=> ${vector}::vector) >= ${minimumSimilarity}
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${topK}
  `
}
