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
