# Copy to Codex — UTC /registration visual implementation

Use the user-provided mockup `utc-registration-reference.png` as the visual reference, alongside `utc-visual-spec.md` and `utc-design-tokens.css`. Copy the three reference files into `docs/ui-redesign/` and place `utc-registration-reference.png` in `docs/ui-redesign/evidence/` before starting, unless equivalent files already exist. Do not rely on image being automatically accessible to Codex just because it exists in another ChatGPT conversation.

You are a principal UI/UX engineer implementing a **real** React+Vite+TypeScript page for the UTC final-year project management system. Read `AGENTS.md`, the current frontend architecture, shared kit, `frontend/src/design-system.css`, route `/registration`, related services, state machine and RBAC before modifications.

1. Do a brief UI/code review, list existing components/files and identify 5 high-impact deltas against the image. Keep the current working behavior and business state.
2. Implement the brand system in the **existing** design tokens, without replacing global CSS blindly. Use navy / blue / UTC yellow / white, official logo asset when provided, refined text hierarchy, subtle cards and restrained shadows.
3. Build the actual desktop layout: useful sidebar and topbar, term/date/status strip, three-section form, advisor preferences, saved registration summary and rules; use real data and real UI controls. Do **not** render the phone frames or the promotional tiles from the composite image.
4. Implement tablet and mobile layouts using responsive CSS and accessible drawer/accordions if appropriate. Preserve form input state when sections collapse; provide touch-friendly preference actions and safe footer behavior during soft-keyboard interaction.
5. Resolve the mockup's state contradictions only by consulting the **existing** workflow: submitted vs pending edits, draft save, potential resubmit, autosave availability, deadline calculation; do not fabricate counters, actions, search, notifications or API responses.
6. Prefer existing Lucide icons and the Be Vietnam Pro typography already in the project. Never use AI-generated logo as official university branding. Campus artwork is optional, must be licensed/available and should not impair use.
7. Add restrained micro-interactions and accessible focus states; support `prefers-reduced-motion`; verify keyboard, form errors, long text, async feedback and mobile behavior.
8. Use Playwright MCP if available to capture results at 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×812, 320×700. Check no overflow, no clipped selected value, drawer, preferences, submission action states, and console/network errors. If unavailable, report limits honestly.
9. Run actual repository typecheck, lint, build and relevant tests; inspect Git diff and shared component regressions.
10. Deliver a concise report: modified files, screenshot locations, implemented visual refinements, verified user flows, tests PASS/FAIL/BLOCKED, state logic decisions and any gaps.

Scope: `/registration` and only essential shared components. Do NOT change API contracts, backend, Prisma schema, RBAC, data or other modules; do not run seed/reset; do not auto commit/push. If tests need mutations, use only approved isolated test data.
