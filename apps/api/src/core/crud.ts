import type { FastifyInstance } from 'fastify';
import type { Model } from 'mongoose';
import type { Permission } from '@erp/contracts';
import { requirePermission } from './security.js';
import { notFound } from './errors.js';
import { writeAudit } from './audit.js';
type Scope=Record<string,unknown>;
type ScopeResolver=(request:any)=>Scope|Promise<Scope>;
type Projection=string|Record<string,0|1>;
type ProjectionResolver=(request:any)=>Projection|undefined|Promise<Projection|undefined>;
type CrudOptions={prefix:string;model:Model<any>;entity:string;readPermission:Permission;writePermission:Permission;searchable?:string[];readScope?:ScopeResolver;writeScope?:ScopeResolver;readProjection?:ProjectionResolver};
const scoped=(scope:Scope,extra:Scope={})=>Object.keys(scope).length?{$and:[scope,extra]}:extra;
export async function registerCrud(app:FastifyInstance,o:CrudOptions){
 const{prefix,model,entity,readPermission,writePermission,searchable=[]}=o;
 app.get(prefix,{preHandler:requirePermission(readPermission)},async(request:any)=>{const page=Math.max(1,Number(request.query?.page??1)),limit=Math.min(100,Math.max(1,Number(request.query?.limit??20))),q=String(request.query?.q??'').trim();const scope=await o.readScope?.(request)??{},search:Scope=q&&searchable.length?{$or:searchable.map(field=>({[field]:{$regex:q,$options:'i'}}))}:{};const filter=scoped(scope,search);const projection=await o.readProjection?.(request);let listQuery=model.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit);if(projection)listQuery=listQuery.select(projection);const[items,total]=await Promise.all([listQuery.lean(),model.countDocuments(filter)]);return{success:true,data:items,meta:{page,limit,total}}});
 app.get(`${prefix}/:id`,{preHandler:requirePermission(readPermission)},async(request:any)=>{const scope=await o.readScope?.(request)??{},projection=await o.readProjection?.(request);let query=model.findOne(scoped(scope,{_id:request.params.id}));if(projection)query=query.select(projection);const item=await query.lean();if(!item)throw notFound(`${entity} not found`);return{success:true,data:item}});
 app.post(prefix,{preHandler:requirePermission(writePermission)},async(request:any)=>{const item=await model.create(request.body);await writeAudit({action:'create',entity,entityId:String(item._id),after:item.toObject(),ip:request.ip});return{success:true,data:item}});
 app.patch(`${prefix}/:id`,{preHandler:requirePermission(writePermission)},async(request:any)=>{const scope=await o.writeScope?.(request)??{},filter=scoped(scope,{_id:request.params.id});const before=await model.findOne(filter).lean();if(!before)throw notFound(`${entity} not found`);const item=await model.findOneAndUpdate(filter,{$set:request.body},{new:true,runValidators:true});await writeAudit({action:'update',entity,entityId:request.params.id,before,after:item?.toObject(),ip:request.ip});return{success:true,data:item}});
 app.delete(`${prefix}/:id`,{preHandler:requirePermission(writePermission)},async(request:any)=>{const scope=await o.writeScope?.(request)??{},filter=scoped(scope,{_id:request.params.id});const before=await model.findOne(filter).lean();if(!before)throw notFound(`${entity} not found`);await model.findOneAndUpdate(filter,{$set:{deletedAt:new Date()}});await writeAudit({action:'delete',entity,entityId:request.params.id,before,ip:request.ip});return{success:true,data:{id:request.params.id}}});
}
