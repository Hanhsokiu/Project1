# Student final PDF frontend

Enable in the frontend environment and restart Vite:

```dotenv
VITE_FINAL_REPORT_API=true
VITE_AUTH_API=true
VITE_API_URL=http://localhost:3000/api
```

The final-report flag defaults to false and is independent of UC17's flag. Off
preserves the existing demo page. Real PDF with mock auth shows a configuration
error. There is no fallback to mock data on HTTP/network errors. The real route
bypasses the demo workspace and never calls its file/data persistence methods.

Open `/guidance/final-report?proposalId=<real-proposal-id>` after real student JWT
login, or enter the proposal ID on the page. Backend checks active account,
student ownership, TermStudent and submission permissions. A student proposal
inbox/automatic proposal selection is not added here.

Connected endpoints under `/api/proposals/:proposalId`:

- GET `final-report-context`: `canSubmit`, `expectedRevision`, size policy, current
  report and independent `FINAL_REPORT_SUBMISSION` window.
- GET `final-report`: current metadata, including explicit absent/legacy states.
- PUT `final-report`: one `file` plus `expectedRevision` in multipart form data.
- GET `final-report/download`: private current PDF, using the common JWT client.

The management GET `/api/terms/:termId/final-report-submission-window` requires
full-term grant and term permissions. Students read the window from their own
context instead; the page neither requests that management API nor expands access.

Upload availability comes from backend `canSubmit` and the dedicated window at
`serverNow`; there is no FINAL phase or UC17 CONFIRMED condition. Limit/extension
policy is read from backend, without the demo 4 MB limit or a hardcoded fallback.
The backend's current default 20 MiB is explicitly temporary. The browser checks
safe name, MIME, size and bounded header/trailer bytes. Backend remains responsible
for full screening, checksum, window recheck, revision CAS and atomic replacement.

Only one current PDF is shown. A successful upload refreshes context and metadata;
there are no optimistic decision/eligibility changes and no PDF version history.
HTTP 409 clears the selected file and blocks another upload until an explicit
reload succeeds and the student chooses a file again. Network/timeouts or invalid
upload acknowledgements may hide a successful commit: the UI also requires reload,
does not claim the old file survived, and does not automatically resend.

Downloading remains available after closing/locking the submission window.
The existing student download endpoint does not accept an expected PDF identity:
it returns the current bytes when the backend handles the request. A fixed safe
download filename avoids associating newer bytes with an older filename. This
differs from the advisor UC17 endpoint's identity assertion. No backend change is
made. Download uses a temporary Blob URL, not a demo URL or localStorage. JWT stays
in the existing session mechanism; no new JWT storage is introduced.

Manual end-to-end testing still needs a verified personal PostgreSQL instance,
existing migrations, real active student login/permissions, owned Proposal and
TermStudent, valid term/window, and private storage. No database setup, seed,
account or persistent test data is created by this integration. Unit responses and
PDF envelopes exist only in process memory; test PASS is not evidence of live DB
or PostgreSQL concurrency testing.
