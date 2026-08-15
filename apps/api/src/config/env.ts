import { z } from 'zod';
const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().int().positive().default(4000),
 MONGODB_URI:z.string().min(1).default('mongodb://localhost:27017/erp_by_anmol'),
 REDIS_URL:z.string().min(1).default('redis://localhost:6379'),
 JWT_ACCESS_SECRET:z.string().min(32).default('development-access-secret-change-me-1234567890'),
 JWT_REFRESH_SECRET:z.string().min(32).default('development-refresh-secret-change-me-1234567890'),
 MFA_ENCRYPTION_KEY:z.string().min(32).default('development-mfa-encryption-key-change-me-1234567890'),
 WORKER_CALLBACK_SECRET:z.string().min(32).default('development-worker-callback-secret-change-me-1234567890'),
 REFRESH_TOKEN_TTL_DAYS:z.coerce.number().int().min(1).max(30).default(7),
 CORS_ORIGINS:z.string().default('http://localhost:5173,http://localhost:5174'),
 COOKIE_DOMAIN:z.string().optional(),
 PASSWORD_RESET_URL:z.string().url().default('http://localhost:5173/reset-password'),
 RAZORPAY_KEY_ID:z.string().optional(),
 RAZORPAY_KEY_SECRET:z.string().optional(),
 RAZORPAY_WEBHOOK_SECRET:z.string().optional(),
 S3_REGION:z.string().default('ap-south-1'),
 S3_BUCKET:z.string().optional(),
 S3_ENDPOINT:z.string().url().optional(),
 S3_FORCE_PATH_STYLE:z.enum(['true','false']).default('false').transform(value=>value==='true'),
 FILE_SCAN_MODE:z.enum(['required','optional','disabled']).default('optional')
});
export const env=schema.parse(process.env);
if(env.NODE_ENV==='production'&&(
 env.JWT_ACCESS_SECRET.startsWith('development-')||
 env.JWT_REFRESH_SECRET.startsWith('development-')||
 env.MFA_ENCRYPTION_KEY.startsWith('development-')||
 env.WORKER_CALLBACK_SECRET.startsWith('development-')
)){throw new Error('Production authentication/internal secrets must be explicitly configured');}
if(env.NODE_ENV==='production'&&!env.S3_BUCKET)throw new Error('S3_BUCKET is required in production');
if(env.NODE_ENV==='production'&&env.FILE_SCAN_MODE!=='required')throw new Error('FILE_SCAN_MODE must be required in production');
export const corsOrigins=env.CORS_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean);
