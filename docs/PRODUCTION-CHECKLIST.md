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

## Required before public launch
- [ ] CI typecheck, tests and builds pass from a clean dependency install on the latest commit.
- [ ] Extend cross-tenant HTTP E2E coverage to every sensitive resource.
- [ ] Every active Platform Super Admin is enrolled in MFA and the recovery procedure is exercised.
- [ ] Managed MongoDB backups are configured and a restore drill is verified.
- [ ] Managed Redis is configured with TLS/auth and eviction policy reviewed.
- [ ] Production email sender/domain and Resend credentials are connected and delivery is verified.
- [ ] Configure production S3-compatible storage, private bucket CORS and workload credentials.
- [ ] Deploy ClamAV scanner workers and verify clean/infected/timeout scenarios.
- [ ] Connect/test the PDF renderer and rendered-document storage pipeline.
- [ ] Complete Razorpay webhook verification and stale payment reconciliation.
- [ ] Secrets are stored in deployment secret manager; development defaults are not accepted in production.
- [ ] WAF/rate limits, alerting, logs and audit retention are configured.
- [ ] Browser E2E covers onboarding, login/MFA, password recovery, admissions, attendance, assignments, marks, result publication, fees and role boundaries.
- [ ] Load test covers dashboard queries, attendance bulk marking, imports and file-scan queues at target tenant size.

The codebase keeps deployment/provider concerns behind explicit boundaries so unfinished infrastructure is visible instead of silently mocked as production-ready.
