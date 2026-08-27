import type { DocumentFormat } from '@/shared/lib/supabase/database.types'

import type { ParserResult, ParserWorkerResponse } from './types'

const PARSER_TIMEOUT_MS = 120_000

export function runDocumentParser(
  format: DocumentFormat,
  buffer: ArrayBuffer,
  onProgress?: (progress: number, label: string) => void,
): Promise<ParserResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new Error('PARSER_TIMEOUT'))
    }, PARSER_TIMEOUT_MS)

    const close = () => {
      window.clearTimeout(timeout)
      worker.terminate()
    }

    worker.onerror = () => {
      close()
      reject(new Error('PARSER_WORKER_FAILED'))
    }
    worker.onmessage = (event: MessageEvent<ParserWorkerResponse>) => {
      if (event.data.type === 'progress') {
        onProgress?.(event.data.progress, event.data.label)
        return
      }
      close()
      resolve(event.data.result)
    }
    worker.postMessage({ type: 'parse', format, buffer }, [buffer])
  })
}
