# Authentication and privileged-access security

## School users
- Access tokens expire after 15 minutes.
- Refresh tokens are rotated on every refresh and only their SHA-256 hashes are stored.
- Password changes revoke all refresh sessions.
- Users created with a temporary password are marked `mustChangePassword` and protected API routes return `PASSWORD_CHANGE_REQUIRED` until the password is replaced.
- Forgot-password responses are intentionally non-enumerating. Reset tokens are random, single-use, hashed in MongoDB, expire after 30 minutes, and revoke all existing sessions after use.
- Password reset emails are queued through Redis/BullMQ; production email delivery uses the configured Resend API key.

## Platform Super Admin
- Platform authentication is isolated from school tenant authentication.
- TOTP MFA uses a five-minute password-login challenge token, so an MFA challenge cannot be used as a platform access token.
- TOTP secrets are encrypted at rest with AES-256-GCM using `MFA_ENCRYPTION_KEY`.
- Recovery codes are shown once and stored only as SHA-256 hashes; each recovery code is single-use.
- Disabling MFA requires both the current platform password and a valid TOTP code.

## Production requirements
1. Generate independent high-entropy values for JWT access, JWT refresh and MFA encryption secrets.
2. Enrol every active Platform Admin in MFA before launch and store recovery codes offline.
3. Configure Redis with TLS/auth, a production email sender/domain, and `RESEND_API_KEY`.
4. Configure the school-web password reset URL using `PASSWORD_RESET_URL`.
5. Rotate credentials immediately after any suspected exposure and review platform/security audit events.
