# ERP BY ANMOL — V2

A clean, production-oriented multi-tenant School ERP SaaS rebuild. The architecture separates the school workspace, privileged platform administration, API and background workers while keeping business domains inside a maintainable modular monolith.

## Applications

```text
apps/web          School ERP (Admin, Teacher, Student, Parent and operational roles)
apps/super-admin  Isolated platform owner console
apps/api          Fastify + MongoDB API
apps/worker       BullMQ background jobs
```

## Implemented domains

Students & guardians, teachers, staff, admissions, custom forms, academic sessions/classes/sections/subjects, conflict-aware timetable, student/faculty attendance, assignments, examinations and controlled marks publishing, report cards, fees/payments/refunds, library, payroll, leaves, notices/grievances/chat/knowledge resources, dynamic documents and public verification, bulk imports, notifications, analytics, biometric ingestion, OASES evaluation, tenant settings and audit logs.

## Security model

- Central AsyncLocalStorage tenant context and Mongoose tenant plugin.
- Explicit tenant scoping for bulk operations that bypass query middleware.
- School module entitlement enforcement and suspended-school blocking.
- Separate platform-admin and school-user trust surfaces.
- Server-side granular RBAC; hiding UI controls is never treated as authorization.
- 15-minute access tokens with hashed, rotated refresh sessions for school users.
- HTTP-only cookies, strict CORS allow-list, Helmet and rate limiting.
- Soft delete and audit trails for sensitive generic mutations.

## Local development

Requirements: Node.js 22+, MongoDB 8+, Redis 7+.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev:api
npm run dev:web
npm run dev:super
npm run dev:worker
```

Seed the first platform owner after setting `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`:

```bash
npm run seed:platform -w @erp/api
```

## Verification

```bash
npm run verify:structure
npm run typecheck
npm test
npm run build
```

CI runs the same verification on pull requests.

## Release status

This branch is the V2 production rebuild baseline and is intentionally reviewed through a draft PR before merge. Before a public production launch, complete managed-provider integrations (email/PDF/object storage/payment gateway), platform MFA/WebAuthn, backup/restore drills, dependency/security scanning, full browser E2E coverage and tenant-leakage integration tests. See `docs/SECURITY.md` and `docs/DEPLOYMENT.md`.
