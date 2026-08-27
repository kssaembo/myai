import type { ImportCandidate } from '@/entities/import-job/archive'
import { supabase, type Tables } from '@/shared/lib/supabase'
import type {
  ImportEntryStatus,
  ImportJobStatus,
  ImportType,
} from '@/shared/lib/supabase/database.types'

export type ImportJob = Tables<'import_jobs'>
export type ImportEntry = Tables<'import_entries'>

export interface ImportJobRecord extends ImportJob {
  entries: ImportEntry[]
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function createImportJob(
  ownerId: string,
  importType: ImportType,
  candidates: ImportCandidate[],
) {
  const jobId = crypto.randomUUID()
  const entries = candidates.map((candidate) => ({
    id: candidate.id,
    owner_id: ownerId,
    source_filename: candidate.sourceFilename,
    relative_path: candidate.relativePath,
    size_bytes: candidate.sizeBytes,
    format: candidate.format,
  }))
  const { error } = await supabase.rpc('create_import_job', {
    p_job_id: jobId,
    p_import_type: importType,
    p_entries: entries,
  })
  throwIfError(error)
  return jobId
}

export async function updateImportEntry(
  entryId: string,
  input: {
    status: ImportEntryStatus
    contentHash?: string | null
    documentId?: string | null
    versionId?: string | null
    errorCode?: string | null
    errorMessage?: string | null
  },
) {
  const { error } = await supabase.rpc('update_import_entry', {
    p_entry_id: entryId,
    p_status: input.status,
    p_content_hash: input.contentHash ?? null,
    p_document_id: input.documentId ?? null,
    p_version_id: input.versionId ?? null,
    p_error_code: input.errorCode ?? null,
    p_error_message: input.errorMessage ?? null,
  })
  throwIfError(error)
}

export async function refreshImportJob(jobId: string): Promise<ImportJobStatus> {
  const { data, error } = await supabase.rpc('refresh_import_job', { p_job_id: jobId })
  throwIfError(error)
  if (!data) throw new Error('IMPORT_JOB_NOT_FOUND')
  return data
}

export async function cancelImportJob(jobId: string) {
  const { error } = await supabase.rpc('cancel_import_job', { p_job_id: jobId })
  throwIfError(error)
}

export async function setImportJobStatus(
  jobId: string,
  status: 'validating' | 'uploading' | 'parsing',
) {
  const { error } = await supabase
    .from('import_jobs')
    .update({ status, completed_at: null })
    .eq('id', jobId)
  throwIfError(error)
}

export async function listImportJobs(): Promise<ImportJobRecord[]> {
  const { data: jobs, error } = await supabase
    .from('import_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12)
  throwIfError(error)
  if (!jobs?.length) return []

  const { data: entries, error: entryError } = await supabase
    .from('import_entries')
    .select('*')
    .in(
      'import_job_id',
      jobs.map((job) => job.id),
    )
    .order('created_at')
  throwIfError(entryError)
  const entriesByJob = new Map<string, ImportEntry[]>()
  for (const entry of entries ?? []) {
    entriesByJob.set(entry.import_job_id, [...(entriesByJob.get(entry.import_job_id) ?? []), entry])
  }
  return jobs.map((job) => ({ ...job, entries: entriesByJob.get(job.id) ?? [] }))
}
