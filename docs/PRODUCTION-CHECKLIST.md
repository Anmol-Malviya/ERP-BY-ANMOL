# Production Launch Checklist

## Implemented in code
- [x] Rotating refresh sessions with hashed refresh-token storage.
- [x] Forced temporary-password replacement before normal ERP access.
- [x] Non-enumerating password reset with hashed, expiring, single-use reset tokens.
- [x] Platform TOTP MFA with encrypted secret storage and one-time recovery codes.
- [x] Redis/BullMQ email job boundary with a real Resend HTTP provider adapter.
- [x] CI provisions real MongoDB/Redis services and runs tenant-isolation integration tests.
- [x] Core tenant integration coverage verifies list/read/update/write/aggregate isolation between two schools.
- [x] Same-school object scopes protect Student, Parent and Teacher records.
- [x] Private S3-compatible upload intents constrain MIME/size and verify uploaded metadata before use.
- [x] Uploaded files remain inaccessible until ClamAV reports CLEAN; infected objects are rejected/deleted.
- [x] Assignment submissions bind Student identity to the authenticated profile and Teacher mutations to owned assignments.
- [x] Verified school documents use immutable issue-time snapshots and a QUEUED → RENDERING → READY/FAILED → REVOKED lifecycle.
- [x] Certificate/document PDF jobs render in workers, store into private tenant prefixes, persist SHA-256/size metadata and expose only short-lived signed downloads.
- [x] Public document verification reveals validation state/serial metadata without exposing private PDF storage paths.
- [x] Student/teacher bulk imports use scanned private CSV/XLSX sources, persistent async jobs, bounded parsing, tenant-scoped validation and background 200-row batches.
- [x] Import source processing is bounded to 20 MB, 50,000 rows, 100 columns and 2,000 characters per cell, with validation errors persisted for operators.
- [x] Import queue payloads carry object references rather than duplicating bulk student/teacher PII into Redis jobs.
- [x] Report cards validate configured-subject completeness and use academic-session-scoped attendance before freezing a sanitized result snapshot.
- [x] Report-card PDF jobs use a QUEUED → RENDERING → READY/FAILED lifecycle, private tenant storage, SHA-256 metadata and expiring download URLs.
- [x] Student/Parent report-card APIs expose only published exam results; Teacher visibility follows assigned-student scope.
- [x] Dedicated responsive workflows are wired for Documents, Bulk Import and Report Cards instead of routing those surfaces through a generic record viewer.

## Required before public launch
- [ ] CI typecheck, tests and builds pass from a clean dependency install on the latest commit.
- [ ] Extend cross-tenant HTTP E2E coverage to every sensitive resource.
- [ ] Every active Platform Super Admin is enrolled in MFA and the recovery procedure is exercised.
- [ ] Managed MongoDB backups are configured and a restore drill is verified.
- [ ] Managed Redis is configured with TLS/auth and eviction policy reviewed.
- [ ] Production email sender/domain and Resend credentials are connected and delivery is verified.
- [ ] Configure production S3-compatible storage, private bucket CORS, default encryption and workload credentials.
- [ ] Deploy ClamAV scanner workers and verify clean/infected/timeout scenarios.
- [ ] Validate document/report rendering with real school templates, long multi-page outputs and required production language/font coverage.
- [ ] Add compressed-size/uncompressed-size abuse tests for large or intentionally hostile XLSX archives before accepting public high-volume imports.
- [ ] Configure/test Razorpay credentials, webhook endpoint reachability and stale payment reconciliation against a production-like account.
- [ ] Secrets are stored in deployment secret manager; development defaults are not accepted in production.
- [ ] WAF/rate limits, alerting, logs and audit retention are configured.
- [ ] Browser E2E covers onboarding, login/MFA, password recovery, admissions, attendance, assignments, marks, result publication, fees, imports, report cards, documents and role boundaries.
- [ ] Load test covers dashboard queries, attendance bulk marking, imports, document/report PDF jobs and file-scan queues at target tenant size.

The codebase keeps deployment/provider concerns behind explicit boundaries so unfinished infrastructure is visible instead of silently mocked as production-ready.
