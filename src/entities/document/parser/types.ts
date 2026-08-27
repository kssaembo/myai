import type {
  DocumentFormat,
  ParseStatus,
  SectionChunkKind,
} from '@/shared/lib/supabase/database.types'

export interface ParserSection {
  ordinal: number
  parentOrdinal: number | null
  heading: string | null
  headingLevel: number | null
  headingPath: string[]
  content: string
  chunkKind: SectionChunkKind
  locator: Record<string, string | number | boolean | null>
  contentHash: string
  tokenEstimate: number
}

export interface ParserResult {
  status: ParseStatus
  contentText: string | null
  sections: ParserSection[]
  parserName: string
  parserVersion: string
  errorCode: string | null
  errorMessage: string | null
  warnings: string[]
}

export interface ParserWorkerRequest {
  type: 'parse'
  format: DocumentFormat
  buffer: ArrayBuffer
}

export type ParserWorkerResponse =
  { type: 'progress'; progress: number; label: string } | { type: 'result'; result: ParserResult }

export interface ParserBlock {
  heading: string | null
  headingLevel: number | null
  headingPath: string[]
  content: string
  chunkKind: SectionChunkKind
  locator: Record<string, string | number | boolean | null>
}
