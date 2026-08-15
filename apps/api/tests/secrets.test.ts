import { describe,expect,it } from 'vitest';
import { decryptSecret,encryptSecret } from '../src/core/secrets.js';
describe('encrypted secret storage',()=>{it('round-trips encrypted values',()=>{const encrypted=encryptSecret('totp-secret-value');expect(encrypted).not.toContain('totp-secret-value');expect(decryptSecret(encrypted)).toBe('totp-secret-value')});it('rejects tampered ciphertext',()=>{const parts=encryptSecret('protected').split('.');parts[3]='AA';expect(()=>decryptSecret(parts.join('.'))).toThrow()})});
