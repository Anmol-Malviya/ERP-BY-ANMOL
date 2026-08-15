import { describe,expect,it } from 'vitest';
import { signMfaChallenge,verifyMfaChallenge } from '../src/core/security.js';
describe('platform MFA challenge tokens',()=>{it('issues a challenge that cannot be confused with a platform access session',async()=>{const token=await signMfaChallenge('platform-admin-1');const claims=await verifyMfaChallenge(token);expect(claims.sub).toBe('platform-admin-1');expect(claims.type).toBe('platform_mfa')})});
