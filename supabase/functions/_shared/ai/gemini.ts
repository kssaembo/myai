import type { AIGenerateRequest, AIGenerateResult, AIProvider } from './types.ts'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  error?: { message?: string }
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const

  constructor(private readonly apiKey: string) {}

  async generateText(request: AIGenerateRequest): Promise<AIGenerateResult> {
    const response = await fetch(
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
          },
        }),
      },
    )
    const payload = (await response.json()) as GeminiResponse
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
}
