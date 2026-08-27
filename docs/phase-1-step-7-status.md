# Phase 1 Step 7 — Batch and ZIP Import Jobs

Status: implemented locally on 2026-08-27.

## Included

- Ordinary multi-file import and ZIP/REF ZIP import modes
- Maximum 200MiB ZIP, 200 internal files, and 500MiB total expanded metadata limit
- ZIP traversal, absolute path, symlink, encrypted archive, nested ZIP, overlap, and signature checks
- Unsupported formats recorded as per-entry `skipped` results
- Independent validation, SHA-256 duplicate detection, private upload, and Step 6 parsing per supported file
- Job/Entry progress and terminal counts for parsed, partial, failed, duplicate, and skipped results
- Cancellation between entries and retry of failed/partial entries while the original browser selection remains available
- Recent Job history with per-file errors and links to created Documents
- RLS-aware database functions that do not bypass the authenticated owner boundary

## Migration

Apply `supabase/migrations/20260827000400_batch_imports.sql` after Step 6. It adds:

- `create_import_job`
- `update_import_entry`
- `refresh_import_job`
- `cancel_import_job`

## Gate

Create a ZIP containing at least:

- one valid Markdown file such as `REF_SECRET_NUMBER_CLASSROOM_EDITION.md`
- one second supported document
- one unsupported asset such as PNG
- one intentionally invalid supported file

The invalid Entry must fail without stopping the valid documents. The PNG must be `skipped`, valid documents must be linked and parsed, and the final Job must be `partial`.

## Scope boundary

- REF section aliasing, REF profile detection, structuring, coverage, and review UI remain Step 8.
- Evidence and Relation creation remain Step 8 or later.
- OCR execution, embeddings, AI chat, auto-tagging, auto-relation recommendations, and memory inference are not included.
