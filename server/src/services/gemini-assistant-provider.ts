export interface AssistantTextProvider {
  streamText(prompt: string, signal: AbortSignal, onText: (text: string) => void): Promise<void>
}

interface GeminiAssistantConfig {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs: number
}

export class AssistantTimeoutError extends Error {
  constructor() {
    super('Policy assistant request timed out')
    this.name = 'AssistantTimeoutError'
  }
}

function streamedText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('candidates' in payload)) {
    throw new Error('Invalid provider response')
  }
  const candidates = payload.candidates
  if (!Array.isArray(candidates)) {
    throw new Error('Invalid provider response')
  }

  const content = candidates[0]?.content
  if (typeof content !== 'object' || content === null || !('parts' in content)) {
    return ''
  }
  const parts = content.parts
  if (!Array.isArray(parts)) {
    throw new Error('Invalid provider response')
  }
  return parts
    .filter((part): part is { text: string } =>
      typeof part === 'object' &&
      part !== null &&
      'text' in part &&
      typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

export class GeminiAssistantProvider implements AssistantTextProvider {
  constructor(private readonly config: GeminiAssistantConfig) {}

  async streamText(
    prompt: string,
    signal: AbortSignal,
    onText: (text: string) => void,
  ): Promise<void> {
    const endpoint = new URL(
      `${this.config.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(this.config.model)}:streamGenerateContent`,
    )
    endpoint.searchParams.set('alt', 'sse')

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.config.timeoutMs)
    const forwardAbort = () => controller.abort(signal.reason)
    signal.addEventListener('abort', forwardAbort, { once: true })

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        throw new Error('Provider request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const consumeEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!data || data === '[DONE]') return
        const text = streamedText(JSON.parse(data))
        if (text) onText(text)
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() ?? ''
        for (const event of events) consumeEvent(event)
        if (done) break
      }
      if (buffer.trim()) consumeEvent(buffer)
    } catch {
      if (timedOut || signal.aborted) {
        throw new AssistantTimeoutError()
      }
      throw new Error('Provider request failed')
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', forwardAbort)
    }
  }
}

export function createGeminiAssistantProvider(): GeminiAssistantProvider {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const model = process.env.LLM_MODEL?.trim()
  const baseUrl = process.env.LLM_BASE_URL?.trim()
  if (!apiKey || !model || !baseUrl) {
    throw new Error('Policy assistant provider is not configured')
  }

  let parsedBaseUrl: URL
  try {
    parsedBaseUrl = new URL(baseUrl)
  } catch {
    throw new Error('Policy assistant provider is not configured')
  }

  const isHttps = parsedBaseUrl.protocol === 'https:'
  const isLocalHttp =
    process.env.NODE_ENV !== 'production' &&
    parsedBaseUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsedBaseUrl.hostname)
  if (!isHttps && !isLocalHttp) {
    throw new Error('Policy assistant provider is not configured')
  }

  return new GeminiAssistantProvider({
    apiKey,
    model,
    baseUrl: parsedBaseUrl.toString().replace(/\/+$/, ''),
    timeoutMs: 30_000,
  })
}
