import type { Category, Tag } from '@/entities/taxonomy/api'
import { supabase, type Tables } from '@/shared/lib/supabase'
import type { DocumentKind } from '@/shared/lib/supabase/database.types'

import type { ValidatedDocumentFile } from './file-validation'

export type Document = Tables<'documents'>
export type DocumentVersion = Tables<'document_versions'>

export interface DuplicateDocument {
  itemId: string
  title: string
  sourceFilename: string
  versionId: string
  createdAt: string
}

export interface NewDocumentInput {
  ownerId: string
  title: string
  summary: string
  categoryId: string | null
  tagIds: string[]
  documentKind: DocumentKind
  validated: ValidatedDocumentFile
  onStorageUploaded?: () => void
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function findDuplicateDocument(
  contentHash: string,
): Promise<DuplicateDocument | null> {
  const { data: version, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('content_hash', contentHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  throwIfError(error)
  if (!version) return null

  const { data: item, error: itemError } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', version.document_id)
    .single()
  throwIfError(itemError)
  if (!item) return null
  return {
    itemId: item.id,
    title: item.title,
    sourceFilename: version.source_filename,
    versionId: version.id,
    createdAt: version.created_at,
  }
}

export async function createUploadedDocument(input: NewDocumentInput) {
  const itemId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const path = `${input.ownerId}/${itemId}/${versionId}/original.${input.validated.extension}`
  const bucket = supabase.storage.from('knowledge-originals')
  const { error: uploadError } = await bucket.upload(path, input.validated.file, {
    cacheControl: '3600',
    contentType: input.validated.mimeType,
    upsert: false,
  })
  throwIfError(uploadError)
  input.onStorageUploaded?.()

  const { error } = await supabase.rpc('create_document_upload', {
    p_item_id: itemId,
    p_version_id: versionId,
    p_title: input.title.trim(),
    p_source_filename: input.validated.file.name,
    p_summary: input.summary.trim(),
    p_category_id: input.categoryId,
    p_document_kind: input.documentKind,
    p_format: input.validated.format,
    p_mime_type: input.validated.mimeType,
    p_size_bytes: input.validated.file.size,
    p_storage_path: path,
    p_content_hash: input.validated.contentHash,
    p_raw_markdown: null,
    p_is_editable: input.validated.format === 'md' || input.validated.format === 'txt',
    p_tag_ids: input.tagIds,
  })

  if (error) {
    await bucket.remove([path])
    throw new Error(error.message)
  }
  return itemId
}

export async function readDocumentMetadata(itemId: string) {
  const [documentResult, versionsResult] = await Promise.all([
    supabase.from('documents').select('*').eq('item_id', itemId).single(),
    supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', itemId)
      .order('version_number', { ascending: false }),
  ])
  throwIfError(documentResult.error)
  throwIfError(versionsResult.error)
  if (!documentResult.data) throw new Error('문서 메타데이터를 찾을 수 없습니다.')
  return { document: documentResult.data, versions: versionsResult.data ?? [] }
}

export async function addUploadedDocumentVersion(
  ownerId: string,
  documentId: string,
  validated: ValidatedDocumentFile,
) {
  const versionId = crypto.randomUUID()
  const path = `${ownerId}/${documentId}/${versionId}/original.${validated.extension}`
  const bucket = supabase.storage.from('knowledge-originals')
  const { error: uploadError } = await bucket.upload(path, validated.file, {
    cacheControl: '3600',
    contentType: validated.mimeType,
    upsert: false,
  })
  throwIfError(uploadError)

  const { data, error } = await supabase.rpc('add_document_version', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_source_filename: validated.file.name,
    p_format: validated.format,
    p_mime_type: validated.mimeType,
    p_size_bytes: validated.file.size,
    p_storage_path: path,
    p_content_hash: validated.contentHash,
    p_raw_markdown: null,
  })
  if (error) {
    await bucket.remove([path])
    throw new Error(error.message)
  }
  return { versionId, versionNumber: data }
}

export async function downloadDocumentVersion(version: DocumentVersion) {
  const { data, error } = await supabase.storage
    .from('knowledge-originals')
    .createSignedUrl(version.storage_path, 60, { download: version.source_filename })
  throwIfError(error)
  if (!data) throw new Error('다운로드 주소를 만들지 못했습니다.')
  const anchor = document.createElement('a')
  anchor.href = data.signedUrl
  anchor.download = version.source_filename
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export interface DocumentUploadOptions {
  categories: Category[]
  tags: Tag[]
}
