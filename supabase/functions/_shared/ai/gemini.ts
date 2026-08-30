import type {
  AIEmbedRequest,
  AIEmbedResult,
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
} from './types.ts'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  error?: { message?: string }
}

interface GeminiEmbeddingResponse {
  embeddings?: Array<{ values?: number[] }>
  usageMetadata?: { promptTokenCount?: number }
  error?: { message?: string }
}

const GEMINI_TIMEOUT_MS = 25_000

async function fetchGeminiJson<T>(url: string, init: RequestInit, timeoutCode: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const payload = (await response.json()) as T
    return { response, payload }
  } catch (caught) {
    if (controller.signal.aborted || (caught instanceof Error && caught.name === 'AbortError'))
      throw new Error(timeoutCode)
    throw caught
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeEmbedding(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error('GEMINI_EMBEDDING_INVALID')
  return values.map((value) => value / magnitude)
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const

  constructor(private readonly apiKey: string) {}

  async generateText(request: AIGenerateRequest): Promise<AIGenerateResult> {
    const { response, payload } = await fetchGeminiJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: request.maxOutputTokens,
            ...(request.responseMimeType ? { responseMimeType: request.responseMimeType } : {}),
          },
        }),
      },
      'GEMINI_TIMEOUT',
    )
    if (!response.ok)
      throw new Error(`GEMINI_HTTP_${response.status}:${payload.error?.message ?? ''}`)
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
    if (!text) throw new Error('GEMINI_EMPTY_RESPONSE')
    return {
      text,
      inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    }
  }

  async embedTexts(request: AIEmbedRequest): Promise<AIEmbedResult> {
    if (!request.texts.length || request.texts.length > 20)
      throw new Error('GEMINI_EMBEDDING_BATCH_INVALID')
    const modelName = `models/${request.model}`
    const { response, payload } = await fetchGeminiJson<GeminiEmbeddingResponse>(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:batchEmbedContents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          requests: request.texts.map((text) => ({
            model: modelName,
            content: { parts: [{ text }] },
            embedContentConfig: {
              taskType: request.taskType,
              outputDimensionality: request.dimensions,
              autoTruncate: true,
            },
          })),
        }),
      },
      'GEMINI_EMBED_TIMEOUT',
    )
    if (!response.ok)
      throw new Error(`GEMINI_EMBED_HTTP_${response.status}:${payload.error?.message ?? ''}`)
    const embeddings = payload.embeddings?.map((embedding) => embedding.values ?? []) ?? []
    if (
      embeddings.length !== request.texts.length ||
      embeddings.some((embedding) => embedding.length !== request.dimensions)
    )
      throw new Error('GEMINI_EMBEDDING_INVALID')
    return {
      embeddings: embeddings.map(normalizeEmbedding),
      inputTokens:
        payload.usageMetadata?.promptTokenCount ??
        Math.ceil(request.texts.reduce((sum, text) => sum + text.length, 0) / 4),
    }
  }
}
