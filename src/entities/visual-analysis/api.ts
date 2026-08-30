import { supabase } from '@/shared/lib/supabase'
import type {
  Tables,
  VisualInsightKind,
  VisualInsightStatus,
} from '@/shared/lib/supabase/database.types'

const RELATIONSHIP_ANALYSIS_TIMEOUT_MS = 55_000

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

export type VisualAnalysisRunSummary = Pick<
  Tables<'visual_analysis_runs'>,
  'id' | 'status' | 'model' | 'created_at' | 'completed_at' | 'error_code'
>

export interface RelationshipAnalysisResult {
  ok: boolean
  cached: boolean
  analysisId: string
  insightCount: number
  model?: string
}

async function throwIfFunctionError(error: { message: string; context?: unknown } | null) {
  if (!error) return
  if (error.context instanceof Response) {
    try {
      const payload = (await error.context.clone().json()) as { error?: unknown }
      if (typeof payload.error === 'string') throw new Error(payload.error)
    } catch (caught) {
      if (caught instanceof Error && caught.message !== 'Unexpected end of JSON input') throw caught
    }
  }
  throw new Error(error.message)
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

export async function getLatestRelationshipAnalysisRun() {
  const { data, error } = await supabase
    .from('visual_analysis_runs')
    .select('id,status,model,created_at,completed_at,error_code')
    .eq('analysis_kind', 'relationship')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function runRelationshipAnalysis(projectIds: string[], force = false) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const response = (await Promise.race([
      supabase.functions.invoke<RelationshipAnalysisResult>('ai-gateway', {
        body: { action: 'relationship_analysis', projectIds, force },
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('AI_RELATIONSHIP_ANALYSIS_TIMEOUT')),
          RELATIONSHIP_ANALYSIS_TIMEOUT_MS,
        )
      }),
    ])) as unknown as {
      data: RelationshipAnalysisResult | null
      error: { message: string; context?: unknown } | null
    }
    await throwIfFunctionError(response.error)
    if (!response.data?.ok || !response.data.analysisId)
      throw new Error('AI_RELATIONSHIP_ANALYSIS_FAILED')
    return response.data
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function reviewVisualInsight(
  insightId: string,
  status: Extract<VisualInsightStatus, 'accepted' | 'rejected'>,
) {
  const { error } = await supabase.rpc('review_visual_insight', {
    p_insight_id: insightId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}
