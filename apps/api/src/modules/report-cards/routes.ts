import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@erp/contracts';
import { Types } from 'mongoose';
import { registerCrud } from '../../core/crud.js';
import { AppError } from '../../core/errors.js';
import { enqueueReport } from '../../core/queue.js';
import { requirePermission } from '../../core/security.js';
import { getTenantContext } from '../../core/tenant-context.js';
import { createDownloadUrl,storageBucket } from '../files/storage.js';
import { assertStudentAccessible,relatedStudentReadScope } from '../people/access.js';
import { Exam } from '../examinations/models.js';
import { registerReportCardCallbacks } from './callbacks.js';
import { ReportCard,ReportTemplate } from './models.js';
import { buildReportCardData } from './service.js';

const validId=(value:any)=>Types.ObjectId.isValid(String(value||''));
const safeName=(value:string)=>value.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120);

export async function reportCardRoutes(app:FastifyInstance){
 await registerReportCardCallbacks(app);
 await registerCrud(app,{prefix:'/api/report-templates',model:ReportTemplate,entity:'report-template',readPermission:PERMISSIONS.REPORT_CARD_READ,writePermission:PERMISSIONS.REPORT_CARD_WRITE,searchable:['name']});
 app.get('/api/report-cards',{preHandler:requirePermission(PERMISSIONS.REPORT_CARD_READ)},async(request:any)=>{
  const scope:any=await relatedStudentReadScope(request),limit=Math.min(Math.max(Number(request.query?.limit)||50,1),200);if(request.query?.studentId){if(!validId(request.query.studentId))throw new AppError(400,'INVALID_STUDENT','Invalid studentId');await assertStudentAccessible(request,request.query.studentId);scope.studentId=new Types.ObjectId(String(request.query.studentId))}if(request.query?.examId){if(!validId(request.query.examId))throw new AppError(400,'INVALID_EXAM','Invalid examId');scope.examId=new Types.ObjectId(String(request.query.examId))}
  if(['STUDENT','PARENT'].includes(request.auth?.role)){const publishedExamIds=await Exam.distinct('_id',{status:'PUBLISHED'});scope.examId=scope.examId?{$eq:scope.examId,$in:publishedExamIds}:{$in:publishedExamIds}}
  const rows=await ReportCard.find(scope).sort({createdAt:-1}).limit(limit).populate('studentId','firstName lastName admissionNo rollNo classId sectionId').populate('examId','name term status').populate('templateId','name version').lean();return{success:true,data:rows};
 });
 app.post('/api/report-cards/generate',{preHandler:requirePermission(PERMISSIONS.REPORT_CARD_WRITE)},async(request:any)=>{
  const{studentId,examId,templateId}=request.body??{};if(!validId(studentId)||!validId(examId)||(templateId&&!validId(templateId)))throw new AppError(400,'INVALID_INPUT','Valid studentId, examId and optional templateId are required');
  const template=templateId?await ReportTemplate.findById(templateId).lean():null;if(templateId&&!template)throw new AppError(404,'NOT_FOUND','Report template not found');const data=await buildReportCardData(studentId,examId);const schoolId=getTenantContext()?.schoolId;if(!schoolId)throw new AppError(403,'TENANT_REQUIRED','School context required');
  let card:any=await ReportCard.findOne({studentId,examId});if(!card)card=new ReportCard({studentId,examId});card.templateId=template?._id;card.snapshot={...data.snapshot,template:template?{id:String(template._id),name:template.name,version:template.version,layout:template.layout}:undefined};card.percentage=data.percentage;card.grade=data.grade;card.result=data.result;card.publishedAt=data.render.published?new Date():undefined;card.pdfStatus='QUEUED';card.pdfFailureReason=undefined;card.pdfBytes=undefined;card.pdfChecksum=undefined;card.pdfGeneratedAt=undefined;card.updatedAt=new Date();card.pdfName=safeName(`report-card-${data.render.admissionNo}-${data.render.examName}.pdf`);card.pdfKey=`schools/${schoolId}/report-cards/${examId}/${card._id}.pdf`;await card.save();
  try{await enqueueReport({reportCardId:String(card._id),schoolId,bucket:storageBucket(),key:card.pdfKey,fileName:card.pdfName,render:data.render})}catch{card.pdfStatus='FAILED';card.pdfFailureReason='Report render job could not be queued';card.updatedAt=new Date();await card.save();throw new AppError(503,'REPORT_QUEUE_UNAVAILABLE','Report card was calculated but PDF rendering could not be queued')}
  return{success:true,data:card};
 });
 app.get('/api/report-cards/:studentId/:examId',{preHandler:requirePermission(PERMISSIONS.REPORT_CARD_READ)},async(request:any)=>{await assertStudentAccessible(request,request.params.studentId);const exam:any=await Exam.findById(request.params.examId).select('status').lean();if(!exam)throw new AppError(404,'NOT_FOUND','Exam not found');if(['STUDENT','PARENT'].includes(request.auth?.role)&&exam.status!=='PUBLISHED')throw new AppError(404,'NOT_FOUND','Published report card not found');const card=await ReportCard.findOne({studentId:request.params.studentId,examId:request.params.examId}).lean();if(!card)throw new AppError(404,'NOT_FOUND','Report card not found');return{success:true,data:card}});
 app.get('/api/report-cards/:studentId/:examId/download',{preHandler:requirePermission(PERMISSIONS.REPORT_CARD_READ)},async(request:any)=>{await assertStudentAccessible(request,request.params.studentId);const[exam,card]:any=await Promise.all([Exam.findById(request.params.examId).select('status').lean(),ReportCard.findOne({studentId:request.params.studentId,examId:request.params.examId}).lean()]);if(!exam||!card)throw new AppError(404,'NOT_FOUND','Report card not found');if(['STUDENT','PARENT'].includes(request.auth?.role)&&exam.status!=='PUBLISHED')throw new AppError(404,'NOT_FOUND','Published report card not found');if(card.pdfStatus!=='READY'||!card.pdfKey)throw new AppError(423,'REPORT_NOT_READY','Report card PDF is not ready');return{success:true,data:{url:await createDownloadUrl(card.pdfKey,card.pdfName||'report-card.pdf'),expiresIn:300}}});
}
