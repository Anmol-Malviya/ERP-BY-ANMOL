# Production Launch Checklist

## Required before public launch
- [ ] CI typecheck, tests and builds pass from a clean dependency install.
- [ ] Cross-tenant E2E suite attempts School A access to School B IDs on every sensitive resource.
- [ ] Platform Super Admin MFA/WebAuthn is enabled and recovery procedure documented.
- [ ] Managed MongoDB backups are configured and restore drill is verified.
- [ ] Managed Redis is configured with TLS/auth and eviction policy reviewed.
- [ ] Email provider, PDF renderer, object storage and payment provider adapters are connected and tested.
- [ ] Upload type/size validation and malware scanning are connected before accepting public uploads.
- [ ] Secrets are stored in deployment secret manager; development defaults are not accepted in production.
- [ ] WAF/rate limits, alerting, logs and audit retention are configured.
- [ ] Browser E2E covers onboarding, login, admissions, attendance, marks, result publication, fees and role boundaries.
- [ ] Load test covers dashboard queries, attendance bulk marking and imports at target tenant size.

The codebase is structured so these deployment/provider concerns can be completed without rewriting business domains.
