export type AIProviderName = 'gemini' | 'openai'

export interface AIGenerateRequest {
  model: string
  systemInstruction: string
  prompt: string
  maxOutputTokens: number
  responseMimeType?: 'application/json'
}

export interface AIGenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
}

export interface AIEmbedRequest {
  model: string
  texts: string[]
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
  dimensions: number
}

export interface AIEmbedResult {
  embeddings: number[][]
  inputTokens: number
}

export interface AIProvider {
  readonly name: AIProviderName
  generateText(request: AIGenerateRequest): Promise<AIGenerateResult>
  embedTexts(request: AIEmbedRequest): Promise<AIEmbedResult>
}
