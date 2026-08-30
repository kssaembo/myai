export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TableDefinition<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type InsertRow<Row, Required extends keyof Row, Generated extends keyof Row = never> = Pick<
  Row,
  Required
> &
  Partial<Omit<Row, Required | Generated>>

type UpdateRow<Row, Immutable extends keyof Row = never> = Partial<Omit<Row, Immutable>>
type EmptySchema = { [_ in never]: never }

export type AppTheme = 'system' | 'light' | 'dark'
export type DefaultView = 'dashboard' | 'knowledge' | 'projects' | 'graph'
export type ItemStatus = 'draft' | 'active' | 'completed' | 'on_hold' | 'archived'
export type ContentOrigin = 'user' | 'imported' | 'rule_import' | 'ai_proposed' | 'ai_accepted'
export type VerificationStatus = 'confirmed' | 'unconfirmed' | 'conflicted'
export type ProjectKind =
  'service' | 'lesson' | 'research' | 'system' | 'utility' | 'idea' | 'other'
export type ProjectLifecycleStatus =
  'idea' | 'planning' | 'developing' | 'testing' | 'deployed' | 'paused' | 'completed'
export type DocumentKind =
  'note' | 'reference' | 'ref' | 'research' | 'manual' | 'source_record' | 'other'
export type DocumentFormat = 'md' | 'txt' | 'pdf' | 'docx'
export type ParseStatus = 'pending' | 'processing' | 'parsed' | 'partial' | 'failed' | 'needs_ocr'
export type VersionChangeReason = 'upload' | 'edit' | 'replace' | 'reparse'
export type SectionChunkKind = 'section' | 'paragraph_group' | 'table' | 'code' | 'list'
export type EvidenceRole =
  'definition' | 'support' | 'contradiction' | 'example' | 'implementation_status'
export type RelationStatus = 'proposed' | 'active' | 'rejected' | 'archived'
export type VisualAnalysisKind = 'relationship' | 'comparison' | 'pattern'
export type VisualAnalysisStatus =
  'queued' | 'processing' | 'completed' | 'partial' | 'failed' | 'superseded'
export type VisualInsightKind =
  | 'commonality'
  | 'difference'
  | 'technical_link'
  | 'reusable_component'
  | 'recurring_problem'
  | 'solution_pattern'
  | 'development_pattern'
  | 'educational_link'
export type VisualInsightStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded'
export type VisualInsightItemRole =
  'subject' | 'source' | 'target' | 'contrast' | 'example' | 'problem' | 'solution'
export type ImportType = 'files' | 'zip' | 'ref_zip'
export type ImportJobStatus =
  | 'queued'
  | 'validating'
  | 'uploading'
  | 'parsing'
  | 'structuring'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
export type ImportEntryStatus =
  'queued' | 'validating' | 'duplicate' | 'uploaded' | 'parsed' | 'partial' | 'failed' | 'skipped'

type ProfileRow = {
  id: string
  display_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

type UserSettingsRow = {
  owner_id: string
  theme: AppTheme
  default_view: DefaultView
  default_ai_allowed: boolean
  graph_settings: Json
  updated_at: string
}

type NodeTypeRow = {
  id: string
  owner_id: string | null
  key: string
  label_ko: string
  label_en: string
  description: string
  color: string
  icon_key: string
  is_system: boolean
  is_active: boolean
  sort_order: number
}

type RelationTypeRow = {
  id: string
  owner_id: string | null
  key: string
  label_ko: string
  label_en: string
  inverse_label_ko: string
  description: string
  is_directional: boolean
  is_symmetric: boolean
  allowed_source_types: string[]
  allowed_target_types: string[]
  color: string
  line_style: string
  is_system: boolean
  is_active: boolean
  sort_order: number
}

type CategoryRow = {
  id: string
  owner_id: string
  name: string
  normalized_name: string
  parent_id: string | null
  color: string | null
  icon_key: string | null
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

type TagRow = {
  id: string
  owner_id: string
  name: string
  normalized_name: string
  color: string | null
  created_at: string
  updated_at: string
}

type TagAliasRow = {
  id: string
  owner_id: string
  tag_id: string
  alias: string
  normalized_alias: string
  created_at: string
}

type KnowledgeItemRow = {
  id: string
  owner_id: string
  node_type_id: string
  title: string
  normalized_title: string
  summary: string | null
  category_id: string | null
  status: ItemStatus
  origin: ContentOrigin
  verification_status: VerificationStatus
  importance: number
  properties: Json
  dedupe_key: string | null
  merged_into_id: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

type ItemAliasRow = {
  id: string
  owner_id: string
  item_id: string
  alias: string
  normalized_alias: string
  origin: ContentOrigin
  created_at: string
}

type ItemTagRow = {
  owner_id: string
  item_id: string
  tag_id: string
  created_at: string
}

type ProjectRow = {
  item_id: string
  owner_id: string
  project_kind: ProjectKind
  lifecycle_status: ProjectLifecycleStatus
  started_at: string | null
  completed_at: string | null
  repository_url: string | null
  service_url: string | null
  current_version_label: string | null
}

type DocumentRow = {
  item_id: string
  owner_id: string
  document_kind: DocumentKind
  active_version_id: string | null
  ai_allowed: boolean
  is_editable: boolean
}

type DocumentVersionRow = {
  id: string
  owner_id: string
  document_id: string
  version_number: number
  source_filename: string
  format: DocumentFormat
  mime_type: string
  size_bytes: number
  storage_path: string
  content_hash: string
  content_text: string | null
  raw_markdown: string | null
  language: string
  parse_status: ParseStatus
  parser_name: string | null
  parser_version: string | null
  parse_error_code: string | null
  parse_error_message: string | null
  change_reason: VersionChangeReason
  created_at: string
}

type DocumentSectionRow = {
  id: string
  owner_id: string
  document_id: string
  version_id: string
  parent_section_id: string | null
  ordinal: number
  canonical_section_key: string | null
  heading: string | null
  heading_level: number | null
  heading_path: string[]
  content: string
  chunk_kind: SectionChunkKind
  locator: Json
  content_hash: string
  token_estimate: number | null
  embedding: string | null
  embedding_model: string | null
  embedded_at: string | null
  created_at: string
}

type ItemEvidenceRow = {
  id: string
  owner_id: string
  item_id: string
  document_id: string | null
  version_id: string | null
  section_id: string | null
  evidence_role: EvidenceRole
  evidence_text: string
  origin: ContentOrigin
  created_at: string
}

type RelationRow = {
  id: string
  owner_id: string
  source_item_id: string
  target_item_id: string
  canonical_source_item_id: string
  canonical_target_item_id: string
  relation_type_id: string
  origin: ContentOrigin
  status: RelationStatus
  confidence: number | null
  rationale: string | null
  created_at: string
  reviewed_at: string | null
  deleted_at: string | null
}

type RelationEvidenceRow = {
  id: string
  owner_id: string
  relation_id: string
  document_id: string
  version_id: string
  section_id: string | null
  evidence_text: string
  origin: ContentOrigin
  created_at: string
}

type VisualAnalysisRunRow = {
  id: string
  owner_id: string
  analysis_kind: VisualAnalysisKind
  status: VisualAnalysisStatus
  model: string | null
  schema_version: string
  prompt_version: string | null
  input_fingerprint: string | null
  source_revision_at: string
  error_code: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

type VisualAnalysisScopeRow = {
  owner_id: string
  analysis_id: string
  item_id: string
  scope_role: string
  ordinal: number
  created_at: string
}

type VisualInsightRow = {
  id: string
  owner_id: string
  analysis_id: string
  insight_kind: VisualInsightKind
  dimension: string
  title: string
  summary: string
  confidence: number | null
  importance: number
  status: VisualInsightStatus
  origin: ContentOrigin
  properties: Json
  promoted_relation_id: string | null
  created_at: string
  reviewed_at: string | null
}

type VisualInsightItemRow = {
  owner_id: string
  insight_id: string
  item_id: string
  item_role: VisualInsightItemRole
  ordinal: number
  weight: number | null
  created_at: string
}

type VisualInsightEvidenceRow = {
  id: string
  owner_id: string
  insight_id: string
  item_id: string
  document_id: string
  version_id: string
  section_id: string | null
  evidence_text: string
  created_at: string
}

type ImportJobRow = {
  id: string
  owner_id: string
  import_type: ImportType
  status: ImportJobStatus
  total_count: number
  success_count: number
  partial_count: number
  failed_count: number
  duplicate_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

type ImportEntryRow = {
  id: string
  owner_id: string
  import_job_id: string
  source_filename: string
  relative_path: string
  size_bytes: number
  format: DocumentFormat | null
  content_hash: string | null
  status: ImportEntryStatus
  document_id: string | null
  version_id: string | null
  error_code: string | null
  error_message: string | null
  detected_ref_profile: string | null
  created_at: string
  updated_at: string
}

type AIProviderSettingsRow = {
  owner_id: string
  provider: string
  chat_model: string
  embedding_model: string
  daily_request_limit: number
  daily_input_token_limit: number
  is_enabled: boolean
  updated_at: string
}

type AIUsageDailyRow = {
  owner_id: string
  usage_date: string
  request_count: number
  input_tokens: number
  output_tokens: number
  updated_at: string
}

type AIRunRow = {
  id: string
  owner_id: string
  provider: string
  model: string
  purpose: string
  status: string
  estimated_input_tokens: number
  input_tokens: number
  output_tokens: number
  duration_ms: number | null
  error_code: string | null
  created_at: string
  completed_at: string | null
}

type AIConversationRow = {
  id: string
  owner_id: string
  title: string
  created_at: string
  updated_at: string
}

type AIMessageRow = {
  id: string
  owner_id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  model: string | null
  input_tokens: number
  output_tokens: number
  created_at: string
}

type AIMessageSourceRow = {
  id: string
  owner_id: string
  message_id: string
  item_id: string
  section_id: string | null
  rank: number
  snippet: string
  created_at: string
}

type AIBriefingRow = {
  id: string
  owner_id: string
  briefing_date: string
  model: string
  summary: string
  recommendations: Json
  source_items: Json
  generated_at: string
}

export type SearchKnowledgeRow = {
  item_id: string
  section_id: string | null
  document_id: string | null
  version_id: string | null
  node_type_key: string
  node_type_label: string
  node_type_color: string
  title: string
  summary: string | null
  category_id: string | null
  category_name: string | null
  tags: Json
  project_id: string | null
  project_title: string | null
  format: DocumentFormat | null
  heading_path: string[]
  locator: Json
  snippet: string
  match_reason: string | null
  score: number
  verification_status: VerificationStatus
  status: ItemStatus
  updated_at: string
  total_count: number
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        InsertRow<ProfileRow, 'id', 'created_at' | 'updated_at'>,
        UpdateRow<ProfileRow, 'id' | 'created_at' | 'updated_at'>
      >
      user_settings: TableDefinition<
        UserSettingsRow,
        InsertRow<UserSettingsRow, 'owner_id', 'updated_at'>,
        UpdateRow<UserSettingsRow, 'owner_id' | 'updated_at'>
      >
      node_types: TableDefinition<
        NodeTypeRow,
        InsertRow<
          NodeTypeRow,
          'key' | 'label_ko' | 'label_en' | 'description' | 'color' | 'icon_key',
          'id'
        >,
        UpdateRow<NodeTypeRow, 'id'>
      >
      relation_types: TableDefinition<
        RelationTypeRow,
        InsertRow<
          RelationTypeRow,
          'key' | 'label_ko' | 'label_en' | 'inverse_label_ko' | 'description' | 'color',
          'id'
        >,
        UpdateRow<RelationTypeRow, 'id'>
      >
      categories: TableDefinition<
        CategoryRow,
        InsertRow<
          CategoryRow,
          'owner_id' | 'name',
          'id' | 'normalized_name' | 'created_at' | 'updated_at'
        >,
        UpdateRow<CategoryRow, 'id' | 'owner_id' | 'normalized_name' | 'created_at' | 'updated_at'>
      >
      tags: TableDefinition<
        TagRow,
        InsertRow<
          TagRow,
          'owner_id' | 'name',
          'id' | 'normalized_name' | 'created_at' | 'updated_at'
        >,
        UpdateRow<TagRow, 'id' | 'owner_id' | 'normalized_name' | 'created_at' | 'updated_at'>
      >
      tag_aliases: TableDefinition<
        TagAliasRow,
        InsertRow<
          TagAliasRow,
          'owner_id' | 'tag_id' | 'alias',
          'id' | 'normalized_alias' | 'created_at'
        >,
        UpdateRow<TagAliasRow, 'id' | 'owner_id' | 'normalized_alias' | 'created_at'>
      >
      knowledge_items: TableDefinition<
        KnowledgeItemRow,
        InsertRow<
          KnowledgeItemRow,
          'owner_id' | 'node_type_id' | 'title',
          'id' | 'normalized_title' | 'created_at' | 'updated_at'
        >,
        UpdateRow<
          KnowledgeItemRow,
          'id' | 'owner_id' | 'normalized_title' | 'created_at' | 'updated_at'
        >
      >
      item_aliases: TableDefinition<
        ItemAliasRow,
        InsertRow<
          ItemAliasRow,
          'owner_id' | 'item_id' | 'alias',
          'id' | 'normalized_alias' | 'created_at'
        >,
        UpdateRow<ItemAliasRow, 'id' | 'owner_id' | 'normalized_alias' | 'created_at'>
      >
      item_tags: TableDefinition<
        ItemTagRow,
        InsertRow<ItemTagRow, 'owner_id' | 'item_id' | 'tag_id', 'created_at'>,
        UpdateRow<ItemTagRow, 'owner_id' | 'item_id' | 'tag_id' | 'created_at'>
      >
      projects: TableDefinition<
        ProjectRow,
        InsertRow<ProjectRow, 'item_id' | 'owner_id'>,
        UpdateRow<ProjectRow, 'item_id' | 'owner_id'>
      >
      documents: TableDefinition<
        DocumentRow,
        InsertRow<DocumentRow, 'item_id' | 'owner_id'>,
        UpdateRow<DocumentRow, 'item_id' | 'owner_id'>
      >
      document_versions: TableDefinition<
        DocumentVersionRow,
        InsertRow<
          DocumentVersionRow,
          | 'owner_id'
          | 'document_id'
          | 'version_number'
          | 'source_filename'
          | 'format'
          | 'mime_type'
          | 'size_bytes'
          | 'storage_path'
          | 'content_hash'
          | 'change_reason',
          'id' | 'created_at'
        >,
        UpdateRow<
          DocumentVersionRow,
          | 'id'
          | 'owner_id'
          | 'document_id'
          | 'version_number'
          | 'source_filename'
          | 'format'
          | 'mime_type'
          | 'size_bytes'
          | 'storage_path'
          | 'content_hash'
          | 'raw_markdown'
          | 'change_reason'
          | 'created_at'
        >
      >
      document_sections: TableDefinition<
        DocumentSectionRow,
        InsertRow<
          DocumentSectionRow,
          'owner_id' | 'document_id' | 'version_id' | 'ordinal' | 'content' | 'content_hash',
          'id' | 'embedding' | 'embedding_model' | 'embedded_at' | 'created_at'
        >,
        UpdateRow<
          DocumentSectionRow,
          | 'id'
          | 'owner_id'
          | 'document_id'
          | 'version_id'
          | 'embedding'
          | 'embedding_model'
          | 'embedded_at'
          | 'created_at'
        >
      >
      item_evidence: TableDefinition<
        ItemEvidenceRow,
        InsertRow<
          ItemEvidenceRow,
          'owner_id' | 'item_id' | 'evidence_role' | 'evidence_text',
          'id' | 'created_at'
        >,
        UpdateRow<ItemEvidenceRow, 'id' | 'owner_id' | 'created_at'>
      >
      relations: TableDefinition<
        RelationRow,
        InsertRow<
          RelationRow,
          'owner_id' | 'source_item_id' | 'target_item_id' | 'relation_type_id',
          'id' | 'canonical_source_item_id' | 'canonical_target_item_id' | 'created_at'
        >,
        UpdateRow<
          RelationRow,
          'id' | 'owner_id' | 'canonical_source_item_id' | 'canonical_target_item_id' | 'created_at'
        >
      >
      relation_evidence: TableDefinition<
        RelationEvidenceRow,
        InsertRow<
          RelationEvidenceRow,
          'owner_id' | 'relation_id' | 'document_id' | 'version_id' | 'evidence_text',
          'id' | 'created_at'
        >,
        UpdateRow<RelationEvidenceRow, 'id' | 'owner_id' | 'created_at'>
      >
      visual_analysis_runs: TableDefinition<
        VisualAnalysisRunRow,
        InsertRow<
          VisualAnalysisRunRow,
          'owner_id' | 'analysis_kind',
          'id' | 'source_revision_at' | 'created_at'
        >,
        UpdateRow<VisualAnalysisRunRow, 'id' | 'owner_id' | 'created_at'>
      >
      visual_analysis_scope: TableDefinition<
        VisualAnalysisScopeRow,
        InsertRow<VisualAnalysisScopeRow, 'owner_id' | 'analysis_id' | 'item_id', 'created_at'>,
        UpdateRow<VisualAnalysisScopeRow, 'owner_id' | 'analysis_id' | 'item_id' | 'created_at'>
      >
      visual_insights: TableDefinition<
        VisualInsightRow,
        InsertRow<
          VisualInsightRow,
          'owner_id' | 'analysis_id' | 'insight_kind' | 'dimension' | 'title' | 'summary',
          'id' | 'created_at'
        >,
        UpdateRow<VisualInsightRow, 'id' | 'owner_id' | 'analysis_id' | 'created_at'>
      >
      visual_insight_items: TableDefinition<
        VisualInsightItemRow,
        InsertRow<VisualInsightItemRow, 'owner_id' | 'insight_id' | 'item_id', 'created_at'>,
        UpdateRow<
          VisualInsightItemRow,
          'owner_id' | 'insight_id' | 'item_id' | 'item_role' | 'created_at'
        >
      >
      visual_insight_evidence: TableDefinition<
        VisualInsightEvidenceRow,
        InsertRow<
          VisualInsightEvidenceRow,
          'owner_id' | 'insight_id' | 'item_id' | 'document_id' | 'version_id' | 'evidence_text',
          'id' | 'created_at'
        >,
        UpdateRow<VisualInsightEvidenceRow, 'id' | 'owner_id' | 'insight_id' | 'created_at'>
      >
      import_jobs: TableDefinition<
        ImportJobRow,
        InsertRow<ImportJobRow, 'owner_id' | 'import_type', 'id' | 'created_at'>,
        UpdateRow<ImportJobRow, 'id' | 'owner_id' | 'created_at'>
      >
      import_entries: TableDefinition<
        ImportEntryRow,
        InsertRow<
          ImportEntryRow,
          'owner_id' | 'import_job_id' | 'source_filename' | 'relative_path' | 'size_bytes',
          'id' | 'created_at' | 'updated_at'
        >,
        UpdateRow<ImportEntryRow, 'id' | 'owner_id' | 'import_job_id' | 'created_at' | 'updated_at'>
      >
      ai_provider_settings: TableDefinition<
        AIProviderSettingsRow,
        InsertRow<AIProviderSettingsRow, 'owner_id', 'updated_at'>,
        UpdateRow<AIProviderSettingsRow, 'owner_id' | 'updated_at'>
      >
      ai_usage_daily: TableDefinition<
        AIUsageDailyRow,
        InsertRow<AIUsageDailyRow, 'owner_id', 'usage_date' | 'updated_at'>,
        UpdateRow<AIUsageDailyRow, 'owner_id' | 'usage_date' | 'updated_at'>
      >
      ai_runs: TableDefinition<
        AIRunRow,
        InsertRow<AIRunRow, 'owner_id' | 'provider' | 'model' | 'purpose', 'id' | 'created_at'>,
        UpdateRow<AIRunRow, 'id' | 'owner_id' | 'created_at'>
      >
      ai_conversations: TableDefinition<
        AIConversationRow,
        InsertRow<AIConversationRow, 'owner_id' | 'title', 'id' | 'created_at' | 'updated_at'>,
        UpdateRow<AIConversationRow, 'id' | 'owner_id' | 'created_at' | 'updated_at'>
      >
      ai_messages: TableDefinition<
        AIMessageRow,
        InsertRow<
          AIMessageRow,
          'owner_id' | 'conversation_id' | 'role' | 'content',
          'id' | 'created_at'
        >,
        UpdateRow<AIMessageRow, 'id' | 'owner_id' | 'conversation_id' | 'created_at'>
      >
      ai_message_sources: TableDefinition<
        AIMessageSourceRow,
        InsertRow<
          AIMessageSourceRow,
          'owner_id' | 'message_id' | 'item_id' | 'rank' | 'snippet',
          'id' | 'created_at'
        >,
        UpdateRow<AIMessageSourceRow, 'id' | 'owner_id' | 'message_id' | 'created_at'>
      >
      ai_briefings: TableDefinition<
        AIBriefingRow,
        InsertRow<
          AIBriefingRow,
          'owner_id' | 'model' | 'summary' | 'recommendations',
          'id' | 'briefing_date' | 'generated_at'
        >,
        UpdateRow<AIBriefingRow, 'id' | 'owner_id' | 'briefing_date' | 'generated_at'>
      >
    }
    Views: EmptySchema
    Functions: {
      add_document_version: {
        Args: {
          p_content_hash: string
          p_document_id: string
          p_format: DocumentFormat
          p_mime_type: string
          p_raw_markdown: string | null
          p_size_bytes: number
          p_source_filename: string
          p_storage_path: string
          p_version_id: string
        }
        Returns: number
      }
      create_document_upload: {
        Args: {
          p_category_id: string | null
          p_content_hash: string
          p_document_kind: DocumentKind
          p_format: DocumentFormat
          p_is_editable: boolean
          p_item_id: string
          p_mime_type: string
          p_raw_markdown: string | null
          p_size_bytes: number
          p_source_filename: string
          p_storage_path: string
          p_summary: string
          p_tag_ids: string[]
          p_title: string
          p_version_id: string
        }
        Returns: string
      }
      commit_document_parse: {
        Args: {
          p_content_text: string | null
          p_error_code: string | null
          p_error_message: string | null
          p_parse_status: ParseStatus
          p_parser_name: string
          p_parser_version: string
          p_sections: Json
          p_version_id: string
        }
        Returns: number
      }
      create_import_job: {
        Args: {
          p_entries: Json
          p_import_type: ImportType
          p_job_id: string
        }
        Returns: number
      }
      update_import_entry: {
        Args: {
          p_content_hash?: string | null
          p_document_id?: string | null
          p_entry_id: string
          p_error_code?: string | null
          p_error_message?: string | null
          p_status: ImportEntryStatus
          p_version_id?: string | null
        }
        Returns: undefined
      }
      refresh_import_job: {
        Args: { p_job_id: string }
        Returns: ImportJobStatus
      }
      cancel_import_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      mark_ref_profile: {
        Args: {
          p_aliases: Json
          p_profile: string
          p_version_id: string
        }
        Returns: number
      }
      commit_ref_review: {
        Args: {
          p_document_id: string
          p_nodes: Json
          p_relations: Json
          p_version_id: string
        }
        Returns: Json
      }
      search_knowledge: {
        Args: {
          p_category_ids?: string[] | null
          p_date_from?: string | null
          p_date_to?: string | null
          p_formats?: DocumentFormat[] | null
          p_node_type_keys?: string[] | null
          p_page?: number
          p_page_size?: number
          p_project_ids?: string[] | null
          p_query?: string
          p_statuses?: ItemStatus[] | null
          p_tag_ids?: string[] | null
          p_verification_statuses?: VerificationStatus[] | null
        }
        Returns: SearchKnowledgeRow[]
      }
      get_project_aggregate: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_knowledge_connections: { Args: { p_item_id: string }; Returns: Json }
      save_relation: {
        Args: {
          p_item_evidence_ids?: string[]
          p_rationale: string
          p_relation_id: string | null
          p_relation_type_id: string
          p_source_item_id: string
          p_status: RelationStatus
          p_target_item_id: string
        }
        Returns: string
      }
      archive_relation: { Args: { p_relation_id: string }; Returns: undefined }
      merge_knowledge_items: {
        Args: { p_duplicate_id: string; p_primary_id: string }
        Returns: Json
      }
      get_knowledge_graph: {
        Args: { p_limit?: number; p_offset?: number; p_project_id?: string | null }
        Returns: Json
      }
      get_visual_relationship_foundation: {
        Args: {
          p_item_ids?: string[] | null
          p_insight_kinds?: VisualInsightKind[] | null
          p_limit?: number
        }
        Returns: Json
      }
      get_relationship_analysis_context: {
        Args: { p_project_ids: string[]; p_evidence_per_project?: number }
        Returns: Json
      }
      begin_visual_relationship_analysis: {
        Args: {
          p_analysis_id: string
          p_model: string
          p_input_fingerprint: string
          p_project_ids: string[]
          p_force?: boolean
        }
        Returns: Json
      }
      complete_visual_relationship_analysis: {
        Args: { p_analysis_id: string; p_insights: Json }
        Returns: Json
      }
      fail_visual_relationship_analysis: {
        Args: { p_analysis_id: string; p_error_code: string }
        Returns: undefined
      }
      review_visual_insight: {
        Args: { p_insight_id: string; p_status: VisualInsightStatus }
        Returns: undefined
      }
      export_knowledge_item: { Args: { p_item_id: string }; Returns: Json }
      trash_knowledge_item: { Args: { p_item_id: string }; Returns: undefined }
      restore_knowledge_item: { Args: { p_item_id: string }; Returns: undefined }
      permanently_delete_knowledge_item: { Args: { p_item_id: string }; Returns: Json }
      get_ai_status: { Args: Record<never, never>; Returns: Json }
      get_embedding_status: { Args: Record<never, never>; Returns: Json }
      get_pending_embedding_sections: {
        Args: { p_limit?: number }
        Returns: {
          section_id: string
          title: string
          heading: string | null
          content: string
          token_estimate: number
        }[]
      }
      save_section_embeddings: {
        Args: { p_model: string; p_embeddings: Json }
        Returns: number
      }
      match_document_sections: {
        Args: {
          p_query_embedding: string
          p_match_count?: number
          p_min_similarity?: number
        }
        Returns: {
          item_id: string
          section_id: string
          title: string
          node_type_label: string
          heading_path: string[]
          snippet: string
          score: number
        }[]
      }
      reserve_ai_request: {
        Args: {
          p_provider: string
          p_model: string
          p_purpose: string
          p_estimated_input_tokens: number
        }
        Returns: Json
      }
      complete_ai_request: {
        Args: {
          p_run_id: string
          p_status: string
          p_input_tokens: number
          p_output_tokens: number
          p_duration_ms: number
          p_error_code?: string | null
        }
        Returns: undefined
      }
      save_ai_exchange: {
        Args: {
          p_conversation_id: string | null
          p_question: string
          p_answer: string
          p_model: string
          p_input_tokens: number
          p_output_tokens: number
          p_sources?: Json
        }
        Returns: Json
      }
      save_ai_briefing: {
        Args: {
          p_model: string
          p_summary: string
          p_recommendations: Json
          p_source_items: Json
        }
        Returns: Json
      }
      normalize_lookup_text: {
        Args: { input_value: string }
        Returns: string
      }
    }
    Enums: {
      app_theme: AppTheme
      default_view: DefaultView
      item_status: ItemStatus
      content_origin: ContentOrigin
      verification_status: VerificationStatus
      project_kind: ProjectKind
      project_lifecycle_status: ProjectLifecycleStatus
      document_kind: DocumentKind
      document_format: DocumentFormat
      parse_status: ParseStatus
      version_change_reason: VersionChangeReason
      section_chunk_kind: SectionChunkKind
      evidence_role: EvidenceRole
      relation_status: RelationStatus
      visual_analysis_kind: VisualAnalysisKind
      visual_analysis_status: VisualAnalysisStatus
      visual_insight_kind: VisualInsightKind
      visual_insight_status: VisualInsightStatus
      visual_insight_item_role: VisualInsightItemRole
      import_type: ImportType
      import_job_status: ImportJobStatus
      import_entry_status: ImportEntryStatus
    }
    CompositeTypes: EmptySchema
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row']

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert']

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update']
