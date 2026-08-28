import { supabase } from '@/shared/lib/supabase'
import type {
  ItemStatus,
  RelationStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'

export interface GraphNodeRecord {
  id: string
  title: string
  summary: string | null
  status: ItemStatus
  verification_status: VerificationStatus
  importance: number
  node_type_key: string
  node_type_label: string
  color: string
  category_name: string | null
  evidence_count: number
  is_center: boolean
}

export interface GraphEdgeRecord {
  id: string
  source_item_id: string
  target_item_id: string
  status: RelationStatus
  relation_type_key: string
  relation_type_label: string
  color: string
  line_style: string
  is_symmetric: boolean
  confidence: number | null
  rationale: string | null
  evidence_count: number
}

export interface GraphPage {
  nodes: GraphNodeRecord[]
  edges: GraphEdgeRecord[]
  offset: number
  next_offset: number
  total_edges: number
  has_more: boolean
}

export async function getKnowledgeGraph(projectId: string | null, offset = 0) {
  const { data, error } = await supabase.rpc('get_knowledge_graph', {
    p_project_id: projectId,
    p_offset: offset,
    p_limit: 100,
  })
  if (error) throw new Error(error.message)
  return data as unknown as GraphPage
}
