import { Schema,model } from 'mongoose';
import { tenantPlugin } from './tenant-plugin.js';
import { getTenantContext } from './tenant-context.js';
const AuditSchema=new Schema({actorId:{type:Schema.Types.ObjectId,ref:'User'},action:{type:String,required:true,index:true},entity:{type:String,required:true,index:true},entityId:String,before:Schema.Types.Mixed,after:Schema.Types.Mixed,ip:String,requestId:String,createdAt:{type:Date,default:Date.now,index:true}},{versionKey:false});
AuditSchema.plugin(tenantPlugin);export const AuditLog=model('AuditLog',AuditSchema);
export async function writeAudit(input:{action:string;entity:string;entityId?:string;before?:unknown;after?:unknown;ip?:string}){const ctx=getTenantContext();return AuditLog.create({...input,actorId:ctx?.userId,requestId:ctx?.requestId})}
