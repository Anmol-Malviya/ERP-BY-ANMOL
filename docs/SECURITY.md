# Security model

- Platform admins and school users are separate identities and endpoints.
- School login resolves tenant by school code server-side.
- 15-minute access tokens; refresh tokens are rotated and stored hashed.
- HTTP-only secure cookies in production.
- Strict CORS allow-list and request rate limiting.
- Server-side permission checks on every sensitive action.
- Central tenant isolation on data models.
- Audit trail for sensitive mutations.
- Soft delete by default.

Before public launch add MFA/WebAuthn for platform admins, managed secrets, upload malware scanning, backup restore drills, dependency scanning and tenant-leakage E2E tests.
