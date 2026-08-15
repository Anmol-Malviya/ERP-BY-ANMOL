import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
const key=createHash('sha256').update(env.MFA_ENCRYPTION_KEY).digest();
export function encryptSecret(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);const tag=cipher.getAuthTag();return ['v1',iv.toString('base64url'),tag.toString('base64url'),encrypted.toString('base64url')].join('.')}
export function decryptSecret(payload:string){const[version,ivRaw,tagRaw,dataRaw]=String(payload||'').split('.');if(version!=='v1'||!ivRaw||!tagRaw||!dataRaw)throw new Error('Invalid encrypted secret');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(ivRaw,'base64url'));decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8')}
