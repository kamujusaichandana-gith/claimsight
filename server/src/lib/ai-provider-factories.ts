import { createGeminiAssistantProvider } from '../services/gemini-assistant-provider.js'
import type { AssistantTextProvider } from '../services/gemini-assistant-provider.js'
import { createGeminiEmbeddingProvider } from '../services/gemini-embedding-provider.js'
import type { EmbeddingProvider } from '../services/gemini-embedding-provider.js'
import { createGeminiSummaryProvider } from '../services/gemini-summary-provider.js'
import type { ClaimSummaryProvider } from '../services/claim-summary.service.js'

export interface AiProviderFactories {
  summary: () => ClaimSummaryProvider
  assistant: () => AssistantTextProvider
  embedding: () => EmbeddingProvider
}

const geminiProviderFactories: AiProviderFactories = {
  summary: createGeminiSummaryProvider,
  assistant: createGeminiAssistantProvider,
  embedding: createGeminiEmbeddingProvider,
}

let providerFactories = geminiProviderFactories

export function getAiProviderFactories(): AiProviderFactories {
  return providerFactories
}

export function setAiProviderFactories(
  overrides: Partial<AiProviderFactories>,
): () => void {
  const previous = providerFactories
  providerFactories = { ...geminiProviderFactories, ...overrides }
  return () => {
    providerFactories = previous
  }
}
