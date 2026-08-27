# Phase 1 Step 5 — File Storage and Document Version

Status: implemented locally on 2026-08-27.

## Included

- Single-file MD, TXT, PDF, and DOCX upload
- 50MiB client validation matching the private bucket limit
- Extension, MIME, UTF-8, PDF signature, and DOCX structure checks
- Browser-side SHA-256 calculation and duplicate detection
- Private Storage path `{owner_id}/{document_id}/{version_id}/original.{ext}`
- Transactional Document/Version metadata creation through RLS-aware RPC
- Immutable new versions without original overwrite
- Document Detail with version history, current version, metadata, and short-lived signed download
- Upload compensation: remove the Storage object when database recording fails

## Migration

Apply `supabase/migrations/20260827000200_document_uploads.sql` after the Foundation migration.
It adds an owner/hash index and two authenticated, security-invoker RPC functions. It does not
change the original private bucket or weaken RLS.

## Scope boundary

- File body parsing and Section creation remain Step 6.
- ZIP and REF ZIP import jobs remain Step 7.
- Automatic Node, Evidence, Relation, and Project extraction remain Step 7–8.
- No file is sent to an AI service.

## Added REF validation input

- `REF_SECRET_NUMBER_CLASSROOM_EDITION.md`
- 757 lines, 51,432 bytes
- SHA-256: `55c095cec3324f6308dce24362e20f6fc2f59f4c8c9d2259567eafc976ca9c64`
- Treated as the 21st initial REF document for later REF import evaluation
