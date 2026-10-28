# UC18 roster preview, DRAFT and OPEN

Enable `VITE_DEFENSE_LIST_API=true` and `VITE_AUTH_API=true`, then restart Vite.
Route: `/defense/eligibility`. The API route authenticates independently of the
demo workspace and never falls back to DemoDb. Flag off preserves the demo screen
with an explicit demo notice; neither configuration creates backend data.

Real endpoints: `GET /defense-lists/terms`, `GET /terms/:termId/defense-list`,
`GET /terms/:termId/defense-list/preview`, `POST /terms/:termId/defense-list`
(empty body), `POST /terms/:termId/defense-list/open` (`expectedRevision`).

Read requires defense-list:read and a matching term/department grant. Create/open
also require defense-list:manage and allDepartments=true. The backend enforces
permissions regardless of frontend role/menu visibility. Duplicate create or
stale open returns 409 and the page reloads state; it never retries a write.

The preview starts from TermStudent, including rows with no Proposal/PDF/decision.
Department previews explicitly report partial coverage and do not expose rows
without verified routing. PDF bytes are verified by the existing advisor UC17
context/download, not by the metadata-only roster preview.

Preview classifications are observations for reconciliation, not persisted
DefenseEligibility decisions or an official admitted list. The academic source,
UC18 time-window policy and reopening policy still need approval. Finalize and
reopen are disabled, with the backend returning explicit capability blockers.
No FINALIZE/REOPEN endpoint has been implemented and no snapshot is produced.

Tests use mocked HTTP/repositories and SSR rendering, not PostgreSQL or browser
end-to-end tests. See docs/audits/step9-uc17-uc18-implementation.md for evidence.
