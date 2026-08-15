import { Schema, Types } from 'mongoose';
import { getTenantContext } from './tenant-context.js';
const QUERY_HOOKS=['find','findOne','countDocuments','updateOne','updateMany','deleteOne','deleteMany','findOneAndUpdate','findOneAndDelete'] as const;
export function tenantPlugin(schema:Schema){
 schema.add({schoolId:{type:Schema.Types.ObjectId,ref:'School',required:true,index:true},deletedAt:{type:Date,default:null,index:true}});
 for(const hook of QUERY_HOOKS)schema.pre(hook as any,function(next){
   const ctx=getTenantContext();
   if(!ctx?.isPlatform){if(!ctx?.schoolId)return next(new Error('Tenant context missing'));this.where({schoolId:ctx.schoolId});}
   this.where({deletedAt:null}); next();
 });
 schema.pre('aggregate',function(next){const ctx=getTenantContext();if(!ctx?.isPlatform){if(!ctx?.schoolId)return next(new Error('Tenant context missing'));this.pipeline().unshift({$match:{schoolId:new Types.ObjectId(ctx.schoolId),deletedAt:null}})}next()});
 schema.pre('validate',function(next){const ctx=getTenantContext();if(!ctx?.isPlatform){if(!ctx?.schoolId)return next(new Error('Tenant context missing'));const doc=this as any;if(!doc.schoolId)doc.schoolId=ctx.schoolId;if(String(doc.schoolId)!==String(ctx.schoolId))return next(new Error('Cross-tenant write rejected'));}next()});
}
