import type { RefNodeProposal, RefRelationProposal, RefStructureResult } from './structure'

import { supabase } from '@/shared/lib/supabase'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function saveRefProfile(versionId: string, result: RefStructureResult) {
  const { data, error } = await supabase.rpc('mark_ref_profile', {
    p_version_id: versionId,
    p_profile: result.profile,
    p_aliases: result.sectionAliases.map((alias) => ({
      section_id: alias.sectionId,
      canonical_key: alias.canonicalKey,
    })),
  })
  throwIfError(error)
  return data ?? 0
}

export async function commitRefReview(
  documentId: string,
  versionId: string,
  nodes: RefNodeProposal[],
  relations: RefRelationProposal[],
) {
  const selectedNodes = nodes.filter((node) => node.selected)
  const selectedIds = new Set(selectedNodes.map((node) => node.localId))
  const selectedRelations = relations.filter(
    (relation) =>
      relation.selected &&
      selectedIds.has(relation.targetRef) &&
      (relation.sourceRef === 'document' || selectedIds.has(relation.sourceRef)),
  )
  const { data, error } = await supabase.rpc('commit_ref_review', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_nodes: selectedNodes.map(nodePayload),
    p_relations: selectedRelations.map(relationPayload),
  })
  throwIfError(error)
  const result = data as { node_count?: number; relation_count?: number } | null
  return { nodeCount: result?.node_count ?? 0, relationCount: result?.relation_count ?? 0 }
}

function nodePayload(node: RefNodeProposal) {
  return {
    local_id: node.localId,
    node_type_key: node.nodeTypeKey,
    title: node.title,
    summary: node.summary,
    section_id: node.sectionId,
    evidence_text: node.evidenceText,
    evidence_role: node.evidenceRole,
    verification_status: node.verificationStatus,
    project_kind: node.projectKind ?? null,
    lifecycle_status: node.lifecycleStatus ?? null,
  }
}

function relationPayload(relation: RefRelationProposal) {
  return {
    local_id: relation.localId,
    source_ref: relation.sourceRef,
    target_ref: relation.targetRef,
    relation_type_key: relation.relationTypeKey,
    section_id: relation.sectionId,
    evidence_text: relation.evidenceText,
    status: relation.status,
  }
}
