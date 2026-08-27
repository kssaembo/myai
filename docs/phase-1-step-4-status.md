# Phase 1 Step 4 — Taxonomy and Knowledge Item CRUD

Status: implemented locally on 2026-08-27.

## Included

- Read-only Node Type and Relation Type dictionaries
- Two-level Category create, edit, archive, and restore
- Tag create, edit, delete, alias create, and alias delete
- Knowledge Item list, URL-preserved local filters, create, edit, archive, and restore
- General Node detail with direct-author Evidence state
- Project-specific extension fields and Projects list
- Live Dashboard counts and recent Knowledge
- In-app destructive confirmation; no browser `alert`, `confirm`, or `prompt`

## Scope boundary

- Document file upload, parsing, versioning, and Markdown body editing remain Step 5–6 work.
- Relation creation, Graph rendering, merge, global search, Trash, and hard deletion remain later work.
- No AI, embeddings, automatic tagging, or automatic relation recommendation was added.
- The existing Foundation schema is sufficient; this step adds no new SQL migration.

## Verification

- Prettier
- ESLint
- TypeScript
- 11 Vitest tests
- Phase 0 ↔ Foundation contract check
- Vite production build
