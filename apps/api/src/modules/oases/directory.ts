import type{FastifyInstance}from'fastify';
import{PERMISSIONS}from'@erp/contracts';
import{requirePermission}from'../../core/security.js';
import{User}from'../identity/models.js';
export async function oasesDirectoryRoutes(app:FastifyInstance){
 app.get('/api/oases/evaluators',{preHandler:requirePermission(PERMISSIONS.OASES_READ)},async()=>({success:true,data:await User.find({isActive:true,oasesRoles:'EVALUATOR',permissions:PERMISSIONS.OASES_EVALUATE}).select('firstName lastName role oasesRoles').sort({firstName:1,lastName:1}).limit(500).lean()}));
}
