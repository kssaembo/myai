import { supabase } from '@/shared/lib/supabase'
import type {
  DocumentFormat,
  EvidenceRole,
  ItemStatus,
  Json,
  ParseStatus,
  RelationStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'

export interface ProjectAggregateStats {
  documents: number
  problems: number
  solutions: number
  decisions: number
  patterns: number
  lessons: number
  confirmed: number
  needs_review: number
  evidence_coverage: number
}

export interface ProjectAggregateDocument {
  id: string
  title: string
  summary: string | null
  status: ItemStatus
  verification_status: VerificationStatus
  document_kind: string
  version_id: string | null
  format: DocumentFormat | null
  source_filename: string | null
  parse_status: ParseStatus | null
  section_id: string | null
  heading_path: string[] | null
  locator: Json | null
}

export interface ProjectAggregateNode {
  id: string
  node_type_key: string
  node_type_label: string
  node_type_color: string
  title: string
  summary: string | null
  status: ItemStatus
  verification_status: VerificationStatus
  updated_at: string
  category_name: string | null
  document_id: string | null
  version_id: string | null
  section_id: string | null
  evidence_text: string | null
  evidence_role: EvidenceRole | null
  heading_path: string[] | null
  locator: Json | null
}

export interface ProjectAggregateRelation {
  id: string
  source_item_id: string
  target_item_id: string
  relation_type_key: string
  relation_type_label: string
  status: RelationStatus
  rationale: string | null
}

export interface ProjectAggregate {
  stats: ProjectAggregateStats
  documents: ProjectAggregateDocument[]
  nodes: ProjectAggregateNode[]
  relations: ProjectAggregateRelation[]
}

export async function getProjectAggregate(projectId: string) {
  const { data, error } = await supabase.rpc('get_project_aggregate', {
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new Error('PROJECT_AGGREGATE_INVALID')
  return data as unknown as ProjectAggregate
}
