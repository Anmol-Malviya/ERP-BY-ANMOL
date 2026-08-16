import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@erp/contracts';
import { requirePermission } from '../../core/security.js';
import { AppError } from '../../core/errors.js';
import { AuditLog } from '../../core/audit.js';

const clean=(value:any,max=120)=>String(value??'').trim().slice(0,max);
export async function auditRoutes(app:FastifyInstance){
 app.get('/api/audit',{preHandler:requirePermission(PERMISSIONS.AUDIT_READ)},async(request:any)=>{const page=Math.max(1,Number(request.query?.page||1)),limit=Math.min(100,Math.max(1,Number(request.query?.limit||50))),filter:any={};if(request.query?.action)filter.action={$regex:`^${clean(request.query.action).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,$options:'i'};if(request.query?.entity)filter.entity=clean(request.query.entity,80);if(request.query?.entityId)filter.entityId=clean(request.query.entityId,120);if(request.query?.actorId){if(!Types.ObjectId.isValid(String(request.query.actorId)))throw new AppError(400,'INVALID_ACTOR','actorId is invalid');filter.actorId=new Types.ObjectId(String(request.query.actorId))}const from=request.query?.from?new Date(String(request.query.from)):undefined,to=request.query?.to?new Date(String(request.query.to)):undefined;if(from&&Number.isNaN(from.getTime())||to&&Number.isNaN(to.getTime()))throw new AppError(400,'INVALID_DATE','Audit date filter is invalid');if(from||to)filter.createdAt={...(from?{$gte:from}:{}),...(to?{$lte:to}:{})};const[items,total]=await Promise.all([AuditLog.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),AuditLog.countDocuments(filter)]);return{success:true,data:items,meta:{page,limit,total}}});
 app.get('/api/audit/entities',{preHandler:requirePermission(PERMISSIONS.AUDIT_READ)},async()=>({success:true,data:await AuditLog.distinct('entity')}));
}
