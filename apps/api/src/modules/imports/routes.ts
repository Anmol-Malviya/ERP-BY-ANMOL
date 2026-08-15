import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@erp/contracts';
import { AppError,forbidden } from '../../core/errors.js';
import { enqueueImport } from '../../core/queue.js';
import { requirePermission } from '../../core/security.js';
import { getTenantContext,runWithTenant } from '../../core/tenant-context.js';
import { env } from '../../config/env.js';
import { FileAsset } from '../files/models.js';
import { storageBucket } from '../files/storage.js';
import { Student,Teacher } from '../people/models.js';
import { ImportJob } from './models.js';
import { prepareStudentRows,prepareTeacherRows,type ImportType,type RowEnvelope } from './service.js';

const allowed=new Set<ImportType>(['students','teachers']);
const validId=(value:any)=>Types.ObjectId.isValid(String(value||''));
function workerSecret(input:string|undefined){const a=Buffer.from(String(input||'')),b=Buffer.from(env.WORKER_CALLBACK_SECRET);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)}

export async function importRoutes(app:FastifyInstance){
 app.get('/api/imports/jobs',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{const limit=Math.min(Math.max(Number(request.query?.limit)||50,1),100);return{success:true,data:await ImportJob.find().sort({createdAt:-1}).limit(limit).lean()}});
 app.get('/api/imports/jobs/:id',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{if(!validId(request.params.id))throw new AppError(404,'NOT_FOUND','Import job not found');const job=await ImportJob.findById(request.params.id).lean();if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');return{success:true,data:job}});

 app.post('/api/imports/jobs',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{
  const{type,sourceAssetId}=request.body??{};if(!allowed.has(type as ImportType)||!validId(sourceAssetId))throw new AppError(400,'INVALID_INPUT','type and a valid sourceAssetId are required');
  const asset:any=await FileAsset.findById(sourceAssetId).lean();if(!asset||asset.purpose!=='import-source')throw new AppError(404,'NOT_FOUND','Import source file not found');if(asset.status!=='READY'||!['CLEAN','SKIPPED'].includes(asset.scanStatus))throw new AppError(423,'FILE_NOT_READY','Import source must pass file verification first');
  const schoolId=getTenantContext()?.schoolId;if(!schoolId)throw new AppError(403,'TENANT_REQUIRED','School context required');const job:any=await ImportJob.create({type,sourceAssetId:asset._id,sourceName:asset.originalName,status:'QUEUED',createdBy:request.auth.sub});
  try{await enqueueImport({jobId:String(job._id),schoolId,bucket:storageBucket(),key:asset.objectKey,contentType:asset.contentType,type,sourceName:asset.originalName})}catch{job.status='FAILED';job.failureReason='Import job could not be queued';job.completedAt=new Date();job.updatedAt=new Date();await job.save();throw new AppError(503,'IMPORT_QUEUE_UNAVAILABLE','Import job could not be queued')}
  return{success:true,data:job};
 });

 app.post('/api/internal/imports/state',async(request:any)=>{
  if(!workerSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials');const{jobId,schoolId,status,totalRows,failureReason}=request.body??{};if(!validId(jobId)||!validId(schoolId)||!['PARSING','IMPORTING','FAILED'].includes(status))throw new AppError(400,'INVALID_IMPORT_STATE','Invalid import state callback');
  return runWithTenant({isPlatform:true,requestId:request.id},async()=>{const job:any=await ImportJob.findOne({_id:jobId,schoolId});if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');if(['COMPLETED','COMPLETED_WITH_ERRORS'].includes(job.status))return{success:true,data:{id:job._id,status:job.status}};job.status=status;if(status==='PARSING'&&!job.startedAt)job.startedAt=new Date();if(Number.isInteger(totalRows)&&totalRows>=0)job.totalRows=totalRows;if(status==='FAILED'){job.failureReason=String(failureReason||'Import failed').slice(0,500);job.completedAt=new Date()}job.updatedAt=new Date();await job.save();return{success:true,data:{id:job._id,status:job.status}}});
 });

 app.post('/api/internal/imports/batch',async(request:any)=>{
  if(!workerSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials');const{jobId,schoolId,type,rows,batchIndex}=request.body??{};
  if(!validId(jobId)||!validId(schoolId)||!allowed.has(type)||!Array.isArray(rows)||rows.length>250||!Number.isInteger(batchIndex)||batchIndex<0)throw new AppError(400,'INVALID_IMPORT_BATCH','Invalid import batch');
  return runWithTenant({isPlatform:true,requestId:request.id},async()=>{
   const job:any=await ImportJob.findOne({_id:jobId,schoolId}).select('+completedBatchIndexes');if(!job||job.type!==type)throw new AppError(404,'NOT_FOUND','Import job not found');if(job.completedBatchIndexes?.includes(batchIndex))return{success:true,data:{duplicate:true,batchIndex}};if(['COMPLETED','COMPLETED_WITH_ERRORS','FAILED'].includes(job.status))throw new AppError(409,'IMPORT_STATE','Import job is already finished');
   const scopedRows:RowEnvelope[]=rows.map((item:any,index:number)=>({row:Number(item?.row)||job.processedRows+index+2,data:item?.data&&typeof item.data==='object'?item.data:{}}));const result=type==='students'?await prepareStudentRows(scopedRows):await prepareTeacherRows(scopedRows);const schoolObjectId=new Types.ObjectId(String(schoolId));const docs=result.prepared.map(doc=>({...doc,schoolId:schoolObjectId,deletedAt:null}));
   let inserted=0;if(docs.length){try{const created=type==='students'?await Student.insertMany(docs,{ordered:true}):await Teacher.insertMany(docs,{ordered:true});inserted=created.length}catch(error:any){if(error?.code===11000){result.errors.push({row:scopedRows[0]?.row||0,field:type==='students'?'admissionNo':'employeeNo',message:'A duplicate identifier was created concurrently'});inserted=0}else throw error}}
   job.status='IMPORTING';job.processedRows+=scopedRows.length;job.insertedRows+=inserted;job.rejectedRows+=result.errors.length;job.errorCount+=result.errors.length;job.completedBatchIndexes=[...(job.completedBatchIndexes||[]),batchIndex];if(result.errors.length)job.errors=[...(job.errors||[]),...result.errors].slice(0,500);job.updatedAt=new Date();await job.save();return{success:true,data:{batchIndex,processed:scopedRows.length,inserted,rejected:result.errors.length}};
  });
 });

 app.post('/api/internal/imports/complete',async(request:any)=>{
  if(!workerSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials');const{jobId,schoolId,totalRows}=request.body??{};if(!validId(jobId)||!validId(schoolId))throw new AppError(400,'INVALID_IMPORT_COMPLETE','Invalid import completion callback');
  return runWithTenant({isPlatform:true,requestId:request.id},async()=>{const job:any=await ImportJob.findOne({_id:jobId,schoolId});if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');if(job.status==='FAILED'||['COMPLETED','COMPLETED_WITH_ERRORS'].includes(job.status))return{success:true,data:job};if(Number.isInteger(totalRows)&&totalRows>=0)job.totalRows=totalRows;job.status=job.errorCount>0?'COMPLETED_WITH_ERRORS':'COMPLETED';job.completedAt=new Date();job.updatedAt=new Date();await job.save();return{success:true,data:job}});
 });
}
