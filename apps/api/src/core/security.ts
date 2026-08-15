import type { FastifyReply,FastifyRequest } from 'fastify';
import { SignJWT,jwtVerify } from 'jose';
import { createHash,randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { unauthorized,forbidden } from './errors.js';
import { DEFAULT_ROLE_PERMISSIONS,type Permission,type SchoolRole } from '@erp/contracts';
const accessKey=new TextEncoder().encode(env.JWT_ACCESS_SECRET),refreshKey=new TextEncoder().encode(env.JWT_REFRESH_SECRET);
export type AccessClaims={sub:string;schoolId?:string;role?:SchoolRole;type:'school'|'platform';permissions?:Permission[];profileId?:string;profileType?:'STUDENT'|'TEACHER'|'STAFF'|'GUARDIAN'};
export const signAccessToken=(c:AccessClaims)=>new SignJWT({...c}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setSubject(c.sub).setExpirationTime('15m').sign(accessKey);
export const signRefreshToken=(c:AccessClaims,jti:string)=>new SignJWT({...c}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setJti(jti).setSubject(c.sub).setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`).sign(refreshKey);
export async function verifyAccessToken(t:string){const{payload}=await jwtVerify(t,accessKey);return payload as unknown as AccessClaims}
export async function verifyRefreshToken(t:string){const{payload}=await jwtVerify(t,refreshKey);return payload as unknown as AccessClaims&{jti:string}}
export const hashToken=(t:string)=>createHash('sha256').update(t).digest('hex');
export const newSessionId=()=>randomBytes(24).toString('hex');
declare module 'fastify'{interface FastifyRequest{auth?:AccessClaims}}
export async function authenticate(request:FastifyRequest){const h=request.headers.authorization;const token=h?.startsWith('Bearer ')?h.slice(7):request.cookies.access_token;if(!token)throw unauthorized();try{request.auth=await verifyAccessToken(token)}catch{throw unauthorized('Invalid or expired session')}}
export function requirePlatform(request:FastifyRequest){if(request.auth?.type!=='platform')throw forbidden('Platform admin access required')}
export function requirePermission(permission:Permission){return async(request:FastifyRequest,_reply:FastifyReply)=>{if(!request.auth)await authenticate(request);if(request.auth?.type==='platform')return;const role=request.auth?.role;const granted=new Set(request.auth?.permissions??(role?DEFAULT_ROLE_PERMISSIONS[role]:[]));if(!granted.has(permission))throw forbidden(`Missing permission: ${permission}`)}}
