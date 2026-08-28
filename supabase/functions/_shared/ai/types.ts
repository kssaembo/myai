export type AIProviderName = 'gemini' | 'openai'

export interface AIGenerateRequest {
  model: string
  systemInstruction: string
  prompt: string
  maxOutputTokens: number
}

export interface AIGenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
}

export interface AIProvider {
  readonly name: AIProviderName
  generateText(request: AIGenerateRequest): Promise<AIGenerateResult>
}
