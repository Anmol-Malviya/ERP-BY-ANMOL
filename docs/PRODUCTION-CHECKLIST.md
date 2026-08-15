# Production Launch Checklist

## Implemented in code
- [x] Rotating refresh sessions with hashed refresh-token storage.
- [x] Forced temporary-password replacement before normal ERP access.
- [x] Non-enumerating password reset with hashed, expiring, single-use reset tokens.
- [x] Platform TOTP MFA with encrypted secret storage and one-time recovery codes.
- [x] Redis/BullMQ email job boundary with a real Resend HTTP provider adapter.
- [x] CI provisions real MongoDB/Redis services and runs tenant-isolation integration tests.
- [x] Core tenant integration coverage verifies list/read/update/write/aggregate isolation between two schools.

## Required before public launch
- [ ] CI typecheck, tests and builds pass from a clean dependency install on the latest commit.
- [ ] Extend cross-tenant E2E coverage to every sensitive HTTP resource, not only the central persistence layer.
- [ ] Every active Platform Super Admin is enrolled in MFA and the recovery procedure is exercised.
- [ ] Managed MongoDB backups are configured and a restore drill is verified.
- [ ] Managed Redis is configured with TLS/auth and eviction policy reviewed.
- [ ] Production email sender/domain and Resend credentials are connected and delivery is verified.
- [ ] PDF renderer, object storage and payment provider adapters are connected and tested.
- [ ] Upload type/size validation and malware scanning are connected before accepting public uploads.
- [ ] Secrets are stored in deployment secret manager; development defaults are not accepted in production.
- [ ] WAF/rate limits, alerting, logs and audit retention are configured.
- [ ] Browser E2E covers onboarding, login/MFA, password recovery, admissions, attendance, marks, result publication, fees and role boundaries.
- [ ] Load test covers dashboard queries, attendance bulk marking and imports at target tenant size.

The codebase keeps deployment/provider concerns behind explicit boundaries so unfinished infrastructure is visible instead of silently mocked as production-ready.
