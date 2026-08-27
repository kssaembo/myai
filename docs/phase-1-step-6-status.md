# Phase 1 Step 6 — Parser and Document Sections

Status: implemented locally on 2026-08-27.

## Included

- Browser Web Worker parsing so large files do not block the main UI
- UTF-8 Markdown and text extraction with heading hierarchy and line locators
- PDF.js page extraction with page locators and scanned-PDF `needs_ocr` detection
- Mammoth DOCX extraction without external-file access or unsafe HTML rendering
- Section chunking around 700 estimated tokens, capped near 1,000, with about 80-token overlap
- SHA-256 content hashes and parent/ordinal structure for every Section
- Atomic, RLS-aware replacement of parse metadata and Sections
- Parse states: `parsed`, `partial`, `failed`, and `needs_ocr`
- Document Detail comparison of private original and extracted Sections
- Version-specific reparse, progress, original download, and Section table of contents

## Migration

Apply `supabase/migrations/20260827000300_parser_sections.sql` after Step 5. It adds the authenticated security-invoker `commit_document_parse` RPC. Existing originals are not modified.

## Validation input

`REF_SECRET_NUMBER_CLASSROOM_EDITION.md` is the main Markdown gate input:

- 757 lines
- 51,432 bytes
- SHA-256 `55c095cec3324f6308dce24362e20f6fc2f59f4c8c9d2259567eafc976ca9c64`

Compare the original and extracted panes, heading boundaries, locator order, and Section sizes after deployment.

## Scope boundary

- OCR execution is not included; scanned PDFs are classified as `needs_ocr`.
- ZIP and REF ZIP import jobs remain Step 7.
- Automatic Node, Evidence, Relation, and Project extraction remain later steps.
- No file is sent to an AI service.
