import { supabase } from '@/shared/lib/supabase'
import type { EvidenceRole, Json, RelationStatus } from '@/shared/lib/supabase/database.types'

export interface ConnectionEvidence {
  id: string
  document_id: string
  version_id: string
  section_id: string | null
  evidence_text: string
  origin: string
}

export interface ItemEvidenceOption extends ConnectionEvidence {
  evidence_role: EvidenceRole
  heading_path: string[] | null
  locator: Json | null
}

export interface ConnectionRelation {
  id: string
  source_item_id: string
  target_item_id: string
  relation_type_id: string
  relation_type_key: string
  relation_type_label: string
  status: RelationStatus
  rationale: string | null
  counterpart_id: string
  counterpart_title: string
  counterpart_type_key: string
  counterpart_type_label: string
  evidence: ConnectionEvidence[]
}

export interface DuplicateCandidate {
  id: string
  title: string
  summary: string | null
  verification_status: string
  similarity: number
}

export interface ConnectionsSnapshot {
  relations: ConnectionRelation[]
  item_evidence: ItemEvidenceOption[]
  duplicate_candidates: DuplicateCandidate[]
}

export async function getKnowledgeConnections(itemId: string) {
  const { data, error } = await supabase.rpc('get_knowledge_connections', { p_item_id: itemId })
  if (error) throw new Error(error.message)
  return data as unknown as ConnectionsSnapshot
}

export async function saveRelation(input: {
  id: string | null
  sourceItemId: string
  targetItemId: string
  relationTypeId: string
  status: RelationStatus
  rationale: string
  itemEvidenceIds: string[]
}) {
  const { data, error } = await supabase.rpc('save_relation', {
    p_relation_id: input.id,
    p_source_item_id: input.sourceItemId,
    p_target_item_id: input.targetItemId,
    p_relation_type_id: input.relationTypeId,
    p_status: input.status,
    p_rationale: input.rationale,
    p_item_evidence_ids: input.itemEvidenceIds,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function archiveRelation(id: string) {
  const { error } = await supabase.rpc('archive_relation', { p_relation_id: id })
  if (error) throw new Error(error.message)
}

export async function mergeKnowledgeItems(primaryId: string, duplicateId: string) {
  const { data, error } = await supabase.rpc('merge_knowledge_items', {
    p_primary_id: primaryId,
    p_duplicate_id: duplicateId,
  })
  if (error) throw new Error(error.message)
  return data
}
