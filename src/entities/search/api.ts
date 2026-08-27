import { supabase } from '@/shared/lib/supabase'
import type {
  DocumentFormat,
  ItemStatus,
  SearchKnowledgeRow,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'

export interface SearchFilters {
  query: string
  nodeTypeKey: string
  categoryId: string
  tagId: string
  projectId: string
  format: '' | DocumentFormat
  verificationStatus: '' | VerificationStatus
  status: '' | ItemStatus
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
}

export interface SearchResponse {
  results: SearchKnowledgeRow[]
  total: number
}

const optionalArray = <T>(value: T | '') => (value === '' ? null : [value])

export async function searchKnowledge(filters: SearchFilters): Promise<SearchResponse> {
  const { data, error } = await supabase.rpc('search_knowledge', {
    p_query: filters.query.trim(),
    p_node_type_keys: optionalArray(filters.nodeTypeKey),
    p_category_ids: optionalArray(filters.categoryId),
    p_tag_ids: optionalArray(filters.tagId),
    p_project_ids: optionalArray(filters.projectId),
    p_formats: optionalArray(filters.format),
    p_verification_statuses: optionalArray(filters.verificationStatus),
    p_statuses: optionalArray(filters.status),
    p_date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00+09:00` : null,
    p_date_to: filters.dateTo ? `${filters.dateTo}T00:00:00+09:00` : null,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })

  if (error) throw new Error(error.message)
  const results = data ?? []
  return { results, total: results[0]?.total_count ?? 0 }
}
