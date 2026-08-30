import { supabase } from '@/shared/lib/supabase'
import type { VisualInsightKind } from '@/shared/lib/supabase/database.types'

export interface VisualInsightMember {
  item_id: string
  title: string
  summary: string | null
  node_type_key: string
  node_type_label: string
  node_type_color: string
  item_role: string
  ordinal: number
  weight: number | null
}

export interface VisualInsightEvidence {
  id: string
  item_id: string
  document_id: string
  version_id: string
  section_id: string | null
  heading_path: string[] | null
  evidence_text: string
}

export interface VisualInsight {
  id: string
  analysis_id: string
  insight_kind: VisualInsightKind
  dimension: string
  title: string
  summary: string
  confidence: number | null
  importance: number
  status: 'proposed' | 'accepted'
  origin: string
  properties: Record<string, unknown>
  promoted_relation_id: string | null
  items: VisualInsightMember[]
  evidence: VisualInsightEvidence[]
}

export interface VisualExistingRelation {
  id: string
  source_item_id: string
  target_item_id: string
  relation_type_key: string
  relation_type_label: string
  color: string
  line_style: string
  status: 'active' | 'proposed'
  confidence: number | null
  rationale: string | null
  evidence_count: number
}

export interface VisualRelationshipFoundation {
  schema_version: 'visual-relations-v1'
  insights: VisualInsight[]
  existing_relations: VisualExistingRelation[]
  dimensions: { dimension: string; count: number; accepted_count: number }[]
}

export async function getVisualRelationshipFoundation(
  itemIds: string[] | null = null,
  insightKinds: VisualInsightKind[] | null = null,
  limit = 200,
) {
  const { data, error } = await supabase.rpc('get_visual_relationship_foundation', {
    p_item_ids: itemIds,
    p_insight_kinds: insightKinds,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('VISUAL_RELATIONSHIP_FOUNDATION_INVALID')
  return data as unknown as VisualRelationshipFoundation
}
