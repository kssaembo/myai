import { GeminiProvider } from './gemini.ts'
import type { AIProvider, AIProviderName } from './types.ts'

export function createAIProvider(name: AIProviderName): AIProvider {
  if (name === 'gemini') {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED')
    return new GeminiProvider(apiKey)
  }
  throw new Error('AI_PROVIDER_NOT_IMPLEMENTED')
}
