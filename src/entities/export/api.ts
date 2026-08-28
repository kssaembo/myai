import { supabase } from '@/shared/lib/supabase'

import {
  buildKnowledgeMarkdown,
  safeDownloadFilename,
  type KnowledgeExportSnapshot,
} from './format'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function readKnowledgeExport(itemId: string) {
  const { data, error } = await supabase.rpc('export_knowledge_item', { p_item_id: itemId })
  throwIfError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('내보내기 데이터를 만들지 못했습니다.')
  return data as KnowledgeExportSnapshot
}

function downloadBlob(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportKnowledgeAsJson(itemId: string, title: string) {
  const snapshot = await readKnowledgeExport(itemId)
  downloadBlob(
    JSON.stringify(snapshot, null, 2),
    safeDownloadFilename(title, 'json'),
    'application/json;charset=utf-8',
  )
}

export async function exportKnowledgeAsMarkdown(itemId: string, title: string) {
  const snapshot = await readKnowledgeExport(itemId)
  downloadBlob(
    buildKnowledgeMarkdown(snapshot),
    safeDownloadFilename(title, 'md'),
    'text/markdown;charset=utf-8',
  )
}
