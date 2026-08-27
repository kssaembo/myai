# Phase 1 Step 8 — REF Profile and Rule Structuring

Status: implemented locally on 2026-08-27.

## Included

- Canonical REF alias dictionary for Overview, Tech Stack, Problems, Change History, Reusable Patterns, Do Not Repeat, Classroom Lessons, and Final Status
- Filename and section-coverage detection profiles: `ref_v1`, `ref_probable`, and `not_ref`
- Rule proposals for Project, Technology, Problem, Solution, Decision, Pattern, Anti-pattern, and Lesson Nodes
- `DOCUMENTS`, `USES`, `HAS_PROBLEM`, `RESOLVED_BY`, `MADE_DECISION`, `REUSES_PATTERN`, and `AVOIDS` Relation proposals
- Evidence required for every rule-imported Node and Relation
- Manual selection, title/summary correction, verification state, Project lifecycle, and Relation status review
- Stable dedupe keys and idempotent Evidence/Relation writes for repeated review
- Canonical section keys and detected REF profile persisted without changing the immutable original Version
- Import Job `structuring` state while an imported REF is under review

## Confirmation boundary

- Rule proposals default to `unconfirmed`.
- The reviewer explicitly chooses `confirmed`, `unconfirmed`, or `conflicted` for each Node.
- Clear structural Relations (`DOCUMENTS`, `HAS_PROBLEM`, `RESOLVED_BY`) default to `active` with Evidence.
- Other Relations default to `proposed` and can be activated or rejected manually.
- `NOT USED` and `REMOVED` technologies are not proposed as used technologies.

## Gate

Review five representative REF documents manually. For each sample verify:

- canonical Section coverage
- source Evidence accuracy
- implemented, partially implemented, not implemented, and UNCONFIRMED distinctions
- Node titles and summaries
- Relation direction and status
- Project lifecycle derived from Final Status

The supplied `REF_SECRET_NUMBER_CLASSROOM_EDITION.md` passed the local rule-engine input check with all eight canonical REF areas detected.

## Scope boundary

- No AI API or external document transmission
- No AI Chat/RAG, embeddings, Vector Search, automatic tags, automatic summaries, AI relation recommendations, or Memory inference
- Conflict Evidence is preserved using `conflicted`; a `CONTRADICTS` Relation is only created when two explicit endpoints are reviewed, not guessed from prose alone.
