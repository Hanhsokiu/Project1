# UC19–UC21 live read and preview

Enable `VITE_DEFENSE_PLANNING_API=true` with `VITE_AUTH_API=true`, restart Vite,
then open `/defense/committees`, `/defense/reviewers`, `/defense/schedule`.
Flag off retains the independent demo screens with explicit demo labels. API
errors never load DemoDb or call the locked legacy committee reader.

The real backend requires an active FACULTY account, defense-planning:read,
defense-planning:preview for previews, and allDepartments=true for the exact term.
No permission alone or ADMIN role bypasses the term grant. Permission definitions
are additive in the existing seed mechanism; nothing is seeded by these screens.

GET context identifies UC18_FINALIZED or ROSTER_PREVIEW. Before a verified seal,
students are preliminary candidates, never an official admitted subset. When a
seal exists the frozen full roster and its admitted flags are used, with stale
current PDF/assignment evidence reported separately. No private file paths or
whole-term snapshot payload is returned to the client.

The three screens maintain an editable React-state plan across navigation. It is
unsaved until the user explicitly saves a draft through the official workflow
panel. That panel reloads server state after each command; the user can explicitly
load saved drafts again. No plan is stored in localStorage/sessionStorage. A 409
requires source review and an explicit reload of server drafts, not silent rebasing.

UC19 proposes 3–5 distinct members and distinct chair/secretary, manually selects
students and an optional hypothetical student-capacity. UC20 selects reviewers
without guessing their required number; the server rejects official-advisor
conflicts using FINALIZED assignments and current AssignmentChange. UC21 takes
explicit start/end times and room, checks conflicts, and lets the user explicitly
state whether reviewers attend for this simulation. It applies no default
30-minute duration, alphabet ordering or policy for publishing.

Stored legacy committee/reviewer/session rows remain UNVERIFIED. Package E adds
DefenseStageWorkflow/DefenseStageArtifact as the separate official authority,
without dual-writing legacy records or opening C01. New APIs fail closed with 503
when the new schema is unavailable. The migration file is for review only and has
not been executed. No official defaults, backfill, accounts or grants are created.

Existing POST .../preview calls still return persisted=false/officialReady=false.
The official panel uses /terms/:termId/defense-workflow for context, PUT stage
drafts, and POST finalize/publish/amend. Official stage mutations require current UC18 V2 provenance,
explicit policy windows, server capabilities, revision/context and whole-term
grants. The approved MVP uses a configured committee size/capacity, exactly one
reviewer per admitted proposal, and mandatory reviewer attendance in official
schedule conflict checks. Manual ordering and explicit start/end are used.

UC18 policy/manual academic evidence and finalize/reopen are on /defense/eligibility.
UC18 reopen is blocked once any downstream has been finalized. The dedicated
/defense/published route uses real authentication and relationship-scoped published
rows only; it never hydrates DemoDb. Notifications are atomic in-app notifications
using the existing consumer, without a new mail sender.

See docs/audits/step9-uc18-uc21-official-implementation.md for Package E status and
actual test evidence. PostgreSQL integration, SQL execution and browser end-to-end
remain separate acceptance work; mock/SSR tests do not prove database behavior.
