import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@erp/contracts';
import { AppError } from '../../core/errors.js';
import { enqueueImport } from '../../core/queue.js';
import { requirePermission } from '../../core/security.js';
import { getTenantContext } from '../../core/tenant-context.js';
import { FileAsset } from '../files/models.js';
import { storageBucket } from '../files/storage.js';
import { registerImportCallbacks } from './callbacks.js';
import { ImportJob } from './models.js';
import type { ImportType } from './service.js';

const allowed=new Set<ImportType>(['students','teachers']);
const validId=(value:any)=>Types.ObjectId.isValid(String(value||''));

export async function importRoutes(app:FastifyInstance){
 await registerImportCallbacks(app);
 app.get('/api/imports/jobs',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{const limit=Math.min(Math.max(Number(request.query?.limit)||50,1),100);return{success:true,data:await ImportJob.find().sort({createdAt:-1}).limit(limit).lean()}});
 app.get('/api/imports/jobs/:id',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{if(!validId(request.params.id))throw new AppError(404,'NOT_FOUND','Import job not found');const job=await ImportJob.findById(request.params.id).lean();if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');return{success:true,data:job}});
 app.post('/api/imports/jobs',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{
  const{type,sourceAssetId}=request.body??{};if(!allowed.has(type as ImportType)||!validId(sourceAssetId))throw new AppError(400,'INVALID_INPUT','type and a valid sourceAssetId are required');
  const asset:any=await FileAsset.findById(sourceAssetId).lean();if(!asset||asset.purpose!=='import-source')throw new AppError(404,'NOT_FOUND','Import source file not found');if(asset.status!=='READY'||!['CLEAN','SKIPPED'].includes(asset.scanStatus))throw new AppError(423,'FILE_NOT_READY','Import source must pass file verification first');
  const schoolId=getTenantContext()?.schoolId;if(!schoolId)throw new AppError(403,'TENANT_REQUIRED','School context required');const job:any=await ImportJob.create({type,sourceAssetId:asset._id,sourceName:asset.originalName,status:'QUEUED',createdBy:request.auth.sub});
  try{await enqueueImport({jobId:String(job._id),schoolId,bucket:storageBucket(),key:asset.objectKey,contentType:asset.contentType,type,sourceName:asset.originalName})}catch{job.status='FAILED';job.failureReason='Import job could not be queued';job.completedAt=new Date();job.updatedAt=new Date();await job.save();throw new AppError(503,'IMPORT_QUEUE_UNAVAILABLE','Import job could not be queued')}
  return{success:true,data:job};
 });
}
