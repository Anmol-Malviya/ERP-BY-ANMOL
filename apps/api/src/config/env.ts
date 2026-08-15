import { z } from 'zod';
const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().int().positive().default(4000),
 MONGODB_URI:z.string().min(1).default('mongodb://localhost:27017/erp_by_anmol'),
 REDIS_URL:z.string().min(1).default('redis://localhost:6379'),
 JWT_ACCESS_SECRET:z.string().min(32).default('development-access-secret-change-me-1234567890'),
 JWT_REFRESH_SECRET:z.string().min(32).default('development-refresh-secret-change-me-1234567890'),
 MFA_ENCRYPTION_KEY:z.string().min(32).default('development-mfa-encryption-key-change-me-1234567890'),
 REFRESH_TOKEN_TTL_DAYS:z.coerce.number().int().min(1).max(30).default(7),
 CORS_ORIGINS:z.string().default('http://localhost:5173,http://localhost:5174'),
 COOKIE_DOMAIN:z.string().optional(),
 PASSWORD_RESET_URL:z.string().url().default('http://localhost:5173/reset-password'),
 RAZORPAY_KEY_ID:z.string().optional(),
 RAZORPAY_KEY_SECRET:z.string().optional(),
 RAZORPAY_WEBHOOK_SECRET:z.string().optional()
});
export const env=schema.parse(process.env);
if(env.NODE_ENV==='production'&&(
 env.JWT_ACCESS_SECRET.startsWith('development-')||
 env.JWT_REFRESH_SECRET.startsWith('development-')||
 env.MFA_ENCRYPTION_KEY.startsWith('development-')
)){throw new Error('Production authentication secrets must be explicitly configured');}
export const corsOrigins=env.CORS_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean);
