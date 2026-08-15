import type { FastifyInstance } from 'fastify';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@erp/contracts';
import { registerCrud } from '../../core/crud.js';
import { AppError,forbidden } from '../../core/errors.js';
import { enqueuePdf } from '../../core/queue.js';
import { requirePermission } from '../../core/security.js';
import { getTenantContext,runWithTenant } from '../../core/tenant-context.js';
import { env } from '../../config/env.js';
import { AcademicClass,Section } from '../academics/models.js';
import { relatedStudentReadScope } from '../people/access.js';
import { Student } from '../people/models.js';
import { createDownloadUrl,storageBucket } from '../files/storage.js';
import { School } from '../tenancy/models.js';
import { DocumentTemplate,GeneratedDocument } from './models.js';
import { formatSchoolAddress,renderTemplateText,type DocumentRenderContext } from './render.js';

function safeWorkerSecret(input:string|undefined){const a=Buffer.from(String(input||'')),b=Buffer.from(env.WORKER_CALLBACK_SECRET);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)}
function validId(value:any){return Types.ObjectId.isValid(String(value||''))}
function safeFileName(value:string){return value.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)}

export async function documentRoutes(app:FastifyInstance){
 await registerCrud(app,{prefix:'/api/document-templates',model:DocumentTemplate,entity:'document-template',readPermission:PERMISSIONS.DOCUMENT_READ,writePermission:PERMISSIONS.DOCUMENT_WRITE,searchable:['name','type','title']});

 app.get('/api/documents/generated',{preHandler:requirePermission(PERMISSIONS.DOCUMENT_READ)},async(request:any)=>{
  const scope=await relatedStudentReadScope(request);
  const limit=Math.min(Math.max(Number(request.query?.limit)||50,1),200);
  const docs=await GeneratedDocument.find(scope).sort({createdAt:-1}).limit(limit).populate('studentId','firstName lastName admissionNo rollNo').populate('templateId','name title type').lean();
  return{success:true,data:docs};
 });

 app.post('/api/documents/generate',{preHandler:requirePermission(PERMISSIONS.DOCUMENT_WRITE)},async(request:any)=>{
  const{templateId,studentId}=request.body??{};
  if(!validId(templateId)||!validId(studentId))throw new AppError(400,'INVALID_INPUT','Valid templateId and studentId are required');
  const ctx=getTenantContext();if(!ctx?.schoolId)throw new AppError(403,'TENANT_REQUIRED','School context required');
  const[template,student,school]=await Promise.all([DocumentTemplate.findOne({_id:templateId,isActive:true}).lean(),Student.findById(studentId).lean(),School.findById(ctx.schoolId).lean()]);
  if(!template)throw new AppError(404,'NOT_FOUND','Active document template not found');
  if(!student)throw new AppError(404,'NOT_FOUND','Student not found');
  if(!school)throw new AppError(404,'NOT_FOUND','School not found');
  const[academicClass,section]=await Promise.all([student.classId?AcademicClass.findById(student.classId).lean():null,student.sectionId?Section.findById(student.sectionId).lean():null]);
  const serialNo=`DOC-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;
  const verificationCode=randomBytes(12).toString('hex').toUpperCase();
  const issuedDate=new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'long',year:'numeric',timeZone:school.timezone||'Asia/Kolkata'}).format(new Date());
  const renderContext:DocumentRenderContext={student:{fullName:`${student.firstName} ${student.lastName||''}`.trim(),admissionNo:String(student.admissionNo||''),rollNo:student.rollNo?String(student.rollNo):undefined,className:academicClass?.name?String(academicClass.name):'',sectionName:section?.name?String(section.name):''},school:{name:String(school.name),address:formatSchoolAddress(school.address)},issued:{date:issuedDate,serialNo,verificationCode}};
  const render={schoolName:renderContext.school.name,schoolAddress:renderContext.school.address,title:renderTemplateText(String(template.title||template.name),renderContext),body:renderTemplateText(String(template.body||''),renderContext),footer:renderTemplateText(String(template.footer||''),renderContext),signerName:String(template.signerName||''),signerDesignation:String(template.signerDesignation||''),serialNo,verificationCode,issuedDate};
  const doc:any=new GeneratedDocument({type:template.type,studentId:student._id,templateId:template._id,serialNo,verificationCode,status:'QUEUED',generatedBy:request.auth.sub,dataSnapshot:{student:renderContext.student,school:renderContext.school,issued:renderContext.issued,template:{name:template.name,type:template.type,title:template.title,body:template.body,footer:template.footer,signerName:template.signerName,signerDesignation:template.signerDesignation}}});
  doc.pdfName=safeFileName(`${template.type}-${serialNo}.pdf`);doc.pdfKey=`schools/${ctx.schoolId}/documents/${new Date().getUTCFullYear()}/${doc._id}.pdf`;await doc.save();
  try{await enqueuePdf({documentId:String(doc._id),schoolId:ctx.schoolId,bucket:storageBucket(),key:doc.pdfKey,fileName:doc.pdfName,render})}catch(error){doc.status='FAILED';doc.failedAt=new Date();doc.failureReason='PDF render job could not be queued';doc.updatedAt=new Date();await doc.save();throw new AppError(503,'PDF_QUEUE_UNAVAILABLE','Document was created but rendering could not be queued')}
  return{success:true,data:doc};
 });

 app.get('/api/documents/generated/:id/download',{preHandler:requirePermission(PERMISSIONS.DOCUMENT_READ)},async(request:any)=>{
  if(!validId(request.params.id))throw new AppError(404,'NOT_FOUND','Document not found');
  const scope=await relatedStudentReadScope(request);const doc:any=await GeneratedDocument.findOne({_id:request.params.id,...scope}).lean();
  if(!doc)throw new AppError(404,'NOT_FOUND','Document not found');
  if(doc.status!=='READY'||!doc.pdfKey)throw new AppError(423,'DOCUMENT_NOT_READY','Document is not ready for download');
  return{success:true,data:{url:await createDownloadUrl(doc.pdfKey,doc.pdfName||`${doc.serialNo}.pdf`),expiresIn:300}};
 });

 app.post('/api/documents/generated/:id/revoke',{preHandler:requirePermission(PERMISSIONS.DOCUMENT_WRITE)},async(request:any)=>{
  if(!validId(request.params.id))throw new AppError(404,'NOT_FOUND','Document not found');const doc:any=await GeneratedDocument.findById(request.params.id);if(!doc)throw new AppError(404,'NOT_FOUND','Document not found');if(doc.status==='REVOKED')return{success:true,data:doc};if(doc.status!=='READY')throw new AppError(409,'DOCUMENT_STATE','Only ready documents can be revoked');doc.status='REVOKED';doc.revokedAt=new Date();doc.updatedAt=new Date();await doc.save();return{success:true,data:doc};
 });

 app.get('/api/documents/verify/:code',async(request:any)=>runWithTenant({isPlatform:true,requestId:request.id},async()=>{const doc:any=await GeneratedDocument.findOne({verificationCode:String(request.params.code||'').toUpperCase()}).select('type serialNo status generatedAt revokedAt verificationCode').lean();if(!doc)return{success:true,data:{valid:false}};return{success:true,data:{valid:doc.status==='READY',revoked:doc.status==='REVOKED',type:doc.type,serialNo:doc.serialNo,status:doc.status,generatedAt:doc.generatedAt,revokedAt:doc.revokedAt}}}));

 app.post('/api/internal/documents/render-result',async(request:any)=>{
  if(!safeWorkerSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials');const{documentId,schoolId,key,status,bytes,checksum,detail}=request.body??{};
  if(!validId(documentId)||!validId(schoolId)||!['RENDERING','READY','FAILED'].includes(status))throw new AppError(400,'INVALID_RENDER_RESULT','Invalid document render callback');
  return runWithTenant({isPlatform:true,requestId:request.id},async()=>{const doc:any=await GeneratedDocument.findOne({_id:documentId,schoolId});if(!doc||doc.pdfKey!==key)throw new AppError(404,'NOT_FOUND','Document not found');if(doc.status==='REVOKED')return{success:true,data:{id:doc._id,status:doc.status}};if(status==='RENDERING'){doc.status='RENDERING';doc.failureReason=undefined}else if(status==='READY'){doc.status='READY';doc.generatedAt=new Date();doc.failedAt=undefined;doc.failureReason=undefined;doc.pdfBytes=Number(bytes)||undefined;doc.pdfChecksum=String(checksum||'').slice(0,128)||undefined}else{doc.status='FAILED';doc.failedAt=new Date();doc.failureReason=String(detail||'PDF rendering failed').slice(0,500)}doc.updatedAt=new Date();await doc.save();return{success:true,data:{id:doc._id,status:doc.status}}})
 });
}
