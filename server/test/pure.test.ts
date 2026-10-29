import { describe, expect, it } from 'vitest'
import { PolicyType } from '@prisma/client'
import { chunkPolicyMarkdown } from '../src/services/policy-knowledge-base.js'
import { parseCitedSources } from '../src/services/policy-assistant.service.js'

describe('policy markdown chunker', () => {
  it('preserves the document title, section title, and readable word boundaries', () => {
    const chunks = chunkPolicyMarkdown(
      '# Auto Policy\n\n## Collision Coverage\nRepairs are covered. Review the deductible.',
      PolicyType.AUTO,
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      documentTitle: 'Auto Policy',
      sectionTitle: 'Collision Coverage',
      content: 'Repairs are covered. Review the deductible.',
    })
    expect(chunks[0].content).not.toMatch(/[a-z][A-Z]/)
  })

  it('keeps all source words in order across overlapping chunks without joining words', () => {
    const sourceWords = Array.from({ length: 900 }, (_, index) => `token${index}`)
    const chunks = chunkPolicyMarkdown(
      `# Long Policy\n\n## Long Section\n${sourceWords.join(' ')}`,
      PolicyType.AUTO,
    )
    const chunkWords = chunks.map((chunk) => chunk.content.split(/\s+/))
    const reconstructed = [...chunkWords[0]]

    for (const words of chunkWords.slice(1)) {
      let overlap = Math.min(reconstructed.length, words.length)
      while (
        overlap > 0 &&
        reconstructed.slice(-overlap).some((word, index) => word !== words[index])
      ) {
        overlap -= 1
      }
      expect(overlap).toBeGreaterThan(0)
      reconstructed.push(...words.slice(overlap))
    }

    expect(reconstructed).toEqual(sourceWords)
    expect(chunkWords.flat().every((word) => /^token\d+$/.test(word))).toBe(true)
  })
})

describe('citation parser', () => {
  it('only returns citations that refer to retrieved chunks', () => {
    const chunks = [
      {
        documentTitle: 'Auto Policy',
        sectionTitle: 'Coverage',
        content: 'Collision protection.',
        similarity: 0.9,
      },
      {
        documentTitle: 'Auto Policy',
        sectionTitle: 'Exclusions',
        content: 'Wear and tear.',
        similarity: 0.8,
      },
    ]

    expect(parseCitedSources('Covered [1], ignored [0] [3] [99] and [1].', chunks)).toEqual([
      {
        citationNumber: 1,
        documentTitle: 'Auto Policy',
        sectionTitle: 'Coverage',
        content: 'Collision protection.',
      },
    ])
  })
})
