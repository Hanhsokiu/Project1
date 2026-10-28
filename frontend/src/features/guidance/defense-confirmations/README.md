# UC17 frontend integration

Opt in through the frontend environment, then restart Vite:

```dotenv
VITE_DEFENSE_CONFIRMATION_API=true
VITE_AUTH_API=true
VITE_API_URL=http://localhost:3000/api
```

The UC17 flag defaults to off. Turning it off preserves the existing demo screen.
Turning it on without real authentication shows a configuration error; it never
falls back to demo data. The real route bypasses the demo workspace/roster.

Open `/guidance/defense-confirm?proposalId=<real-proposal-id>` after JWT login.
The page has a real inbox using `GET /defense-confirmations/terms` and
`GET /defense-confirmations/inbox?termId=...&view=ADVISOR&status=PENDING&page=1`.
Only current official FINALIZED assignments enter the advisor inbox. Filter by
PENDING, CONFIRMED, REJECTED or UNKNOWN (legacy/unverified decisions). Pagination
and progress summaries come from the backend. The proposal ID form remains for
deep links. There is no mock list fallback.

STUDENT view lists only the student's own roster/dossier and current decision.
FACULTY view requires a matching AcademicTermGrant. Full context and PDF download
remain current-advisor-only; history is available to advisors and scoped faculty.
Actual decision changes notify active scoped faculty readers through the existing
in-app Notification store, atomically with history/audit. No email template or
assignment-specific email worker is repurposed.

All five UC17 endpoints use the shared authenticated HTTP client. The form copies
`expectedRevision` and `expectedContext` from GET context. A PDF download sends
exactly `expectedContext.pdf`; it never marks the PDF as read. Context refresh,
successful PUT and HTTP 409 reset the explicit review acknowledgement. A conflict
refreshes context, current decision and history, with no automatic PUT/download
retry. A failed refresh leaves writing blocked. History uses the backend revision
cursor and 50 items per page.

For manual testing, prepare a separately verified personal PostgreSQL database,
the existing migrations, real active accounts with UC17 permissions, official
assignment/ownership, an approved Proposal, a valid UC17 window, UC18 OPEN and a
verified private PDF for CONFIRMED. REJECTED may omit the PDF when backend permits
it. No database preparation, seed or account creation is performed by this UI.
The student PDF upload screen keeps its independent feature flag and submission
window; changing a PDF does not automatically change the decision or UC18.

Tests use in-memory responses only; they are not evidence of PostgreSQL or live
backend end-to-end testing.
