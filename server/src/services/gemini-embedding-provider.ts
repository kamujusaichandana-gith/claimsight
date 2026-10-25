export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

export interface EmbeddingProvider {
  embed(text: string, taskType: EmbeddingTaskType): Promise<number[]>
}

interface GeminiEmbeddingConfig {
  apiKey: string
  model: string
  baseUrl: string
  dimensions: number
  timeoutMs: number
  minimumRequestIntervalMs: number
  maxRetries: number
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: unknown
  }
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

export function normalizeEmbedding(values: number[]): number[] {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding provider returned an invalid vector')
  }

  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('Embedding provider returned an empty vector')
  }
  if (Math.abs(magnitude - 1) < 1e-6) {
    return values
  }
  return values.map((value) => value / magnitude)
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private lastRequestStartedAt = 0

  constructor(private readonly config: GeminiEmbeddingConfig) {}

  async embed(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const waitMs = this.config.minimumRequestIntervalMs -
        (Date.now() - this.lastRequestStartedAt)
      if (waitMs > 0) {
        await sleep(waitMs)
      }

      this.lastRequestStartedAt = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      let response: Response

      try {
        const endpoint = `${this.config.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(this.config.model)}:embedContent`
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            model: `models/${this.config.model}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: this.config.dimensions,
          }),
          signal: controller.signal,
        })
      } catch {
        clearTimeout(timeout)
        throw new Error('Embedding provider request failed')
      }

      if (response.status === 429 || response.status >= 500) {
        clearTimeout(timeout)
        if (attempt < this.config.maxRetries) {
          await sleep(500 * 2 ** attempt)
          continue
        }
        throw new Error('Embedding provider request failed after retries')
      }
      if (!response.ok) {
        clearTimeout(timeout)
        throw new Error('Embedding provider request failed')
      }

      let payload: GeminiEmbeddingResponse
      try {
        payload = await response.json() as GeminiEmbeddingResponse
      } catch {
        clearTimeout(timeout)
        throw new Error('Embedding provider returned an invalid response')
      }
      clearTimeout(timeout)

      const values = payload.embedding?.values
      if (
        !Array.isArray(values) ||
        values.length !== this.config.dimensions ||
        values.some((value) => typeof value !== 'number')
      ) {
        throw new Error('Embedding provider returned an invalid vector')
      }

      return normalizeEmbedding(values)
    }

    throw new Error('Embedding provider request failed after retries')
  }
}

export function createGeminiEmbeddingProvider(): GeminiEmbeddingProvider {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const model = process.env.EMBEDDING_MODEL?.trim()
  const baseUrl = process.env.LLM_BASE_URL?.trim()
  const dimensionsText = process.env.EMBEDDING_DIMENSIONS?.trim() || '768'
  const dimensions = Number(dimensionsText)

  if (!apiKey || !model || !baseUrl || dimensions !== 768) {
    throw new Error('Embedding provider is not configured')
  }

  let parsedBaseUrl: URL
  try {
    parsedBaseUrl = new URL(baseUrl)
  } catch {
    throw new Error('Embedding provider is not configured')
  }

  const isHttps = parsedBaseUrl.protocol === 'https:'
  const isLocalHttp =
    process.env.NODE_ENV !== 'production' &&
    parsedBaseUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsedBaseUrl.hostname)

  if (!isHttps && !isLocalHttp) {
    throw new Error('Embedding provider is not configured')
  }

  return new GeminiEmbeddingProvider({
    apiKey,
    model,
    baseUrl: parsedBaseUrl.toString().replace(/\/+$/, ''),
    dimensions,
    timeoutMs: 15_000,
    minimumRequestIntervalMs: 1_000,
    maxRetries: 3,
  })
}
