# Clinic application audit — 2026-11-01

## Scope and limitations
This is a source/dependency audit, automated unit testing, real local OCR integration testing, and Playwright UI testing against explicit API fixtures. No configured MySQL database, seeded test users, SMTP/OTP provider or production service credentials were available. **This is not production sign-off or a claim that every button/form works end to end.** Never run destructive billing/restore/merge tests against real patient data.

## Fixes implemented
- Authenticated reference-data cache keys now include the session token; writes invalidate reference caches, cache size is bounded, and removed tokens are not reused from an old Axios instance.
- Credential 401s keep the login form/error visible instead of triggering an unconditional full-page redirect. Late 401s from an older session cannot clear a newer session.
- Login labels, password toggle accessibility and error announcements improved.
- Shared Modal now has dialog semantics, Escape close, keyboard focus trapping, focus restoration and scroll locking; close button cannot accidentally submit a parent form.
- Booking no longer invents available appointment times when the server fails. Stale availability responses are ignored, loading/error feedback is explicit, stale selections cannot submit, phone format is validated and fields have associated labels.
- Preview hosts allowed explicitly by suffix rather than allowing arbitrary hosts.
- Record OCR uploads get a 120-second client timeout rather than the default 15 seconds. Original medical image resolution is preserved instead of shrinking reports to 1080px before OCR.
- Record name/patient validation and friendly upload errors added.
- OCR uses bundled English model data, terminates its worker and clears timeout/temporary files. Image orientation/preprocessing improved.
- PDF extraction now handles multiple pages (maximum 20), embedded text and scanned pages without a Chrome PDF-viewer screenshot. Rendering is bounded; JavaScript evaluation is disabled.
- Lab matching requires a unique normalized exact name: shared words do not establish medical equivalence. Malformed numeric readings are rejected. OCR no longer silently creates global lab templates from unmatched text.
- OCR failure information reaches the UI. Extracted values carry an unverified clinician-review note and a visible reminder to compare the original report.
- Compatible backend and frontend dependency security updates applied without forced major-version upgrades. Frontend production dependency audit is now zero advisories (previously six, including one critical). Recharts react-is peer is now an explicit dependency for reliable builds.

## Verification
- Frontend production build: pass.
- Frontend Vitest: 19 tests pass (including cache/session regressions).
- Backend Jest: 13 tests pass (including five OCR parsing/matching regressions).
- Real OCR integration: PNG, two-page text PDF, two-page scanned PDF and temporary-file cleanup pass.
- Playwright: seven public route renders, 53 protected route fixture renders, login labels/password toggles/invalid-credential feedback, unauthenticated redirect, appointment form submission payload/success feedback, and mobile login overflow check pass. No captured page runtime exceptions in the final run. A role-restricted render may show the access-denied state; this does not verify that role's full workflow.
- ESLint retains 17 pre-existing warnings, mainly missing hook dependencies; they are not evidence of verified production behavior.

## Open risks / release gates
1. Run live-database integration tests for every role (admin/doctor/staff), clinic isolation, CRUD, prescriptions/printing, bill amounts/payments, merge, export and backup/restore on a disposable test database.
2. Test real OTP delivery, resend/expiry, invalid OTP, service outages and authorization on backend routes. Existing legacy E2E script requests a removed `/api/auth/dev-token` endpoint; use real seeded credentials, do not restore an authentication bypass.
3. Backend production npm audit after compatible updates: **23 advisories (12 high, 11 moderate; zero critical)**, down from 35 including three critical before updates. Remaining chains include Puppeteer, Sharp, Nodemailer, Bull, ExcelJS and Swagger tooling. Upgrade/test major versions separately rather than forcing incompatible updates.
4. OCR is English/numeric only; handwriting, Marathi/Hindi and uncommon report layouts are not certified. Readings remain automatically stored under the existing completed-lab workflow, with an explicit unverified note. A clinician-confirmation-before-save workflow and transaction/queue-based OCR should be a separate clinical release gate.
5. OCR extraction has a 60-second processing deadline after worker initialization; PDF resource limits and malformed/encrypted/very large PDF load testing need expansion. Temporary files/native canvas require write access and supported native packages. Backend Node must be >=22.13 for the PDF dependency.
6. Existing stub routes and hook dependency warnings remain to be reviewed with actual API contracts/data. No guarantee of “zero future issues” is possible from fixture tests.

## Repeatable commands
```sh
cd backend
npm ci  # PUPPETEER_SKIP_DOWNLOAD=true if Chrome is managed externally
npm test -- --runInBand
npm run test:ocr
cd ../frontend
npm ci
npm test -- --run
npm run lint
npm run build
# Start the Vite server in another terminal, install Playwright Chromium first:
BASE_URL=http://localhost:5173 npm run test:audit-ui
# Optionally CHROMIUM_PATH=/path/to/chromium for a system browser.
```
