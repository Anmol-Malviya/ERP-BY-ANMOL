import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError,forbidden } from '../../core/errors.js';
import { runWithTenant } from '../../core/tenant-context.js';
import { env } from '../../config/env.js';
import { Student,Teacher } from '../people/models.js';
import { ImportJob } from './models.js';
import { prepareStudentRows,prepareTeacherRows,type ImportType,type RowEnvelope } from './service.js';

const allowed=new Set<ImportType>(['students','teachers']);
const validId=(value:any)=>Types.ObjectId.isValid(String(value||''));
function validWorkerSecret(input:string|undefined){const a=Buffer.from(String(input||'')),b=Buffer.from(env.WORKER_CALLBACK_SECRET);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)}
function authenticateWorker(request:any){if(!validWorkerSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials')}

export async function registerImportCallbacks(app:FastifyInstance){
 app.post('/api/internal/imports/state',async(request:any)=>{
  authenticateWorker(request);const{jobId,schoolId,status,totalRows,failureReason}=request.body??{};if(!validId(jobId)||!validId(schoolId)||!['PARSING','IMPORTING','FAILED'].includes(status))throw new AppError(400,'INVALID_IMPORT_STATE','Invalid import state callback');
  return runWithTenant({schoolId:String(schoolId),requestId:request.id},async()=>{const job:any=await ImportJob.findById(jobId);if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');if(['COMPLETED','COMPLETED_WITH_ERRORS'].includes(job.status))return{success:true,data:{id:job._id,status:job.status}};job.status=status;if(status==='PARSING'&&!job.startedAt)job.startedAt=new Date();if(Number.isInteger(totalRows)&&totalRows>=0)job.totalRows=totalRows;if(status==='FAILED'){job.failureReason=String(failureReason||'Import failed').slice(0,500);job.completedAt=new Date()}job.updatedAt=new Date();await job.save();return{success:true,data:{id:job._id,status:job.status}}});
 });

 app.post('/api/internal/imports/batch',async(request:any)=>{
  authenticateWorker(request);const{jobId,schoolId,type,rows,batchIndex}=request.body??{};if(!validId(jobId)||!validId(schoolId)||!allowed.has(type)||!Array.isArray(rows)||rows.length>250||!Number.isInteger(batchIndex)||batchIndex<0)throw new AppError(400,'INVALID_IMPORT_BATCH','Invalid import batch');
  return runWithTenant({schoolId:String(schoolId),requestId:request.id},async()=>{
   const job:any=await ImportJob.findById(jobId).select('+completedBatchIndexes');if(!job||job.type!==type)throw new AppError(404,'NOT_FOUND','Import job not found');if(job.completedBatchIndexes?.includes(batchIndex))return{success:true,data:{duplicate:true,batchIndex}};if(['COMPLETED','COMPLETED_WITH_ERRORS','FAILED'].includes(job.status))throw new AppError(409,'IMPORT_STATE','Import job is already finished');
   const scopedRows:RowEnvelope[]=rows.map((item:any,index:number)=>({row:Number(item?.row)||job.processedRows+index+2,data:item?.data&&typeof item.data==='object'?item.data:{}}));const result=type==='students'?await prepareStudentRows(scopedRows):await prepareTeacherRows(scopedRows);const schoolObjectId=new Types.ObjectId(String(schoolId));const docs=result.prepared.map(doc=>({...doc,schoolId:schoolObjectId,deletedAt:null}));
   let inserted=0;if(docs.length){try{const created=type==='students'?await Student.insertMany(docs,{ordered:true}):await Teacher.insertMany(docs,{ordered:true});inserted=created.length}catch(error:any){if(error?.code===11000){result.errors.push({row:scopedRows[0]?.row||0,field:type==='students'?'admissionNo':'employeeNo',message:'A duplicate identifier was created concurrently'});inserted=0}else throw error}}
   job.status='IMPORTING';job.processedRows+=scopedRows.length;job.insertedRows+=inserted;job.rejectedRows+=result.errors.length;job.errorCount+=result.errors.length;job.completedBatchIndexes=[...(job.completedBatchIndexes||[]),batchIndex];if(result.errors.length)job.errors=[...(job.errors||[]),...result.errors].slice(0,500);job.updatedAt=new Date();await job.save();return{success:true,data:{batchIndex,processed:scopedRows.length,inserted,rejected:result.errors.length}};
  });
 });

 app.post('/api/internal/imports/complete',async(request:any)=>{
  authenticateWorker(request);const{jobId,schoolId,totalRows}=request.body??{};if(!validId(jobId)||!validId(schoolId))throw new AppError(400,'INVALID_IMPORT_COMPLETE','Invalid import completion callback');
  return runWithTenant({schoolId:String(schoolId),requestId:request.id},async()=>{const job:any=await ImportJob.findById(jobId);if(!job)throw new AppError(404,'NOT_FOUND','Import job not found');if(job.status==='FAILED'||['COMPLETED','COMPLETED_WITH_ERRORS'].includes(job.status))return{success:true,data:job};if(Number.isInteger(totalRows)&&totalRows>=0)job.totalRows=totalRows;job.status=job.errorCount>0?'COMPLETED_WITH_ERRORS':'COMPLETED';job.completedAt=new Date();job.updatedAt=new Date();await job.save();return{success:true,data:job}});
 });
}
