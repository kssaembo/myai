import {
  commitDocumentParse,
  readDocumentSections,
  readOriginalForParsing,
  type DocumentVersion,
} from '@/entities/document/api'
import { runDocumentParser } from '@/entities/document/parser/run-parser'
import { supabase } from '@/shared/lib/supabase'

import {
  structureRefDocument,
  type RefNodeProposal,
  type RefRelationProposal,
  type RefStructureResult,
} from './structure'

export interface RefAutomationCandidate {
  documentId: string
  title: string
  version: DocumentVersion
  structured: boolean
}

export interface RefAutomationResult {
  status: 'structured' | 'needs_review'
  profile: RefStructureResult['profile']
  coverage: number
  nodeCount: number
  relationCount: number
  warnings: string[]
}

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

async function prepareRefAutoStructure(
  documentId: string,
  versionId: string,
  nodes: RefNodeProposal[],
) {
  const { error } = await supabase.rpc('prepare_ref_auto_structure', {
    p_document_id: documentId,
    p_version_id: versionId,
    p_nodes: nodes.filter((node) => node.selected).map(nodePayload),
  })
  throwIfError(error)
}

export async function autoStructureRefDocument(
  documentId: string,
  versionId: string,
  filename: string,
  documentTitle: string,
): Promise<RefAutomationResult> {
  const sections = await readDocumentSections(versionId)
  const result = structureRefDocument(filename, documentTitle, sections)
  await saveRefProfile(versionId, result)
  const hasProject = result.nodes.some((node) => node.nodeTypeKey === 'project' && node.selected)
  if (result.profile !== 'ref_v1' || !hasProject) {
    return {
      status: 'needs_review',
      profile: result.profile,
      coverage: result.coverage,
      nodeCount: 0,
      relationCount: 0,
      warnings: result.warnings,
    }
  }
  await prepareRefAutoStructure(documentId, versionId, result.nodes)
  const saved = await commitRefReview(documentId, versionId, result.nodes, result.relations)
  return {
    status: 'structured',
    profile: result.profile,
    coverage: result.coverage,
    nodeCount: saved.nodeCount,
    relationCount: saved.relationCount,
    warnings: result.warnings,
  }
}

export async function autoStructureExistingRef(candidate: RefAutomationCandidate) {
  if (!['parsed', 'partial'].includes(candidate.version.parse_status)) {
    const buffer = await readOriginalForParsing(candidate.version)
    const parsed = await runDocumentParser(candidate.version.format, buffer)
    await commitDocumentParse(candidate.version.id, parsed)
  }
  return autoStructureRefDocument(
    candidate.documentId,
    candidate.version.id,
    candidate.version.source_filename,
    candidate.title,
  )
}

export async function listRefAutomationCandidates(): Promise<RefAutomationCandidate[]> {
  const { data: documents, error } = await supabase
    .from('documents')
    .select('item_id,active_version_id')
    .eq('document_kind', 'ref')
    .not('active_version_id', 'is', null)
  throwIfError(error)
  if (!documents?.length) return []

  const documentIds = documents.map((document) => document.item_id)
  const versionIds = documents
    .map((document) => document.active_version_id)
    .filter((id): id is string => Boolean(id))
  const [versionResult, itemResult, projectResult] = await Promise.all([
    supabase.from('document_versions').select('*').in('id', versionIds),
    supabase.from('knowledge_items').select('id,title').in('id', documentIds),
    supabase.from('projects').select('item_id'),
  ])
  throwIfError(versionResult.error)
  throwIfError(itemResult.error)
  throwIfError(projectResult.error)

  const projectIds = (projectResult.data ?? []).map((project) => project.item_id)
  const projectItemResult = projectIds.length
    ? await supabase.from('knowledge_items').select('properties').in('id', projectIds)
    : { data: [], error: null }
  throwIfError(projectItemResult.error)
  const structuredDocumentIds = new Set(
    (projectItemResult.data ?? [])
      .map((item) => {
        const properties = item.properties
        return properties && typeof properties === 'object' && !Array.isArray(properties)
          ? properties.source_document_id
          : null
      })
      .filter((id): id is string => typeof id === 'string'),
  )
  const versions = new Map((versionResult.data ?? []).map((version) => [version.id, version]))
  const titles = new Map((itemResult.data ?? []).map((item) => [item.id, item.title]))

  return documents
    .flatMap((document) => {
      const version = document.active_version_id
        ? versions.get(document.active_version_id)
        : undefined
      if (!version) return []
      return [
        {
          documentId: document.item_id,
          title: titles.get(document.item_id) ?? version.source_filename,
          version,
          structured: structuredDocumentIds.has(document.item_id),
        },
      ]
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'ko'))
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
