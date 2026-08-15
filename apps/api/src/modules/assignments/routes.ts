import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@erp/contracts';
import { registerCrud } from '../../core/crud.js';
import { requirePermission } from '../../core/security.js';
import { AppError } from '../../core/errors.js';
import { Assignment,AssignmentSubmission } from './models.js';
import { Student } from '../people/models.js';
import { accessibleStudentIds,assertStudentAccessible } from '../people/access.js';
import { FileAsset } from '../files/models.js';
import { issueDomainAssetDownload } from '../files/service.js';

async function assignmentReadScope(request:any){
 const role=request.auth?.role;
 if(role==='TEACHER')return request.auth?.profileId?{teacherId:request.auth.profileId}:{_id:{$in:[]}};
 if(role==='STUDENT'){
  if(!request.auth?.profileId)return{_id:{$in:[]}};
  const student:any=await Student.findById(request.auth.profileId).select('classId sectionId').lean();
  return student?{classId:student.classId,sectionId:student.sectionId,published:true}:{_id:{$in:[]}};
 }
 if(role==='PARENT'){
  const ids=await accessibleStudentIds(request);if(!ids?.length)return{_id:{$in:[]}};
  const students:any[]=await Student.find({_id:{$in:ids}}).select('classId sectionId').lean();
  const scopes=students.filter(s=>s.classId&&s.sectionId).map(s=>({classId:s.classId,sectionId:s.sectionId,published:true}));
  return scopes.length?{$or:scopes}:{_id:{$in:[]}};
 }
 return{};
}
function assignmentWriteScope(request:any){return request.auth?.role==='TEACHER'?(request.auth?.profileId?{teacherId:request.auth.profileId}:{_id:{$in:[]}}):{}}
async function visibleAssignment(request:any,id:string){const scope=await assignmentReadScope(request);const item:any=await Assignment.findOne(Object.keys(scope).length?{$and:[{_id:id},scope]}:{_id:id});if(!item)throw new AppError(404,'NOT_FOUND','Assignment not found');return item}
async function validateAssets(request:any,ids:any,purpose:'assignment-attachment'|'assignment-submission'){
 const attachments=Array.isArray(ids)?ids.map(String):[];
 if(attachments.length>10)throw new AppError(400,'TOO_MANY_ATTACHMENTS','Maximum 10 attachments are allowed');
 if(!attachments.length)return attachments;
 const unique=[...new Set(attachments)];
 const assets:any[]=await FileAsset.find({_id:{$in:unique},purpose,status:'READY',scanStatus:{$in:['CLEAN','SKIPPED']}}).lean();
 if(assets.length!==unique.length)throw new AppError(422,'INVALID_ATTACHMENT','One or more attachments are unavailable or not cleared');
 if(request.auth?.role==='STUDENT'&&assets.some(asset=>String(asset.createdBy)!==String(request.auth.sub)))throw new AppError(403,'ATTACHMENT_OWNERSHIP','Students may use only their own uploaded attachments');
 if(request.auth?.role==='TEACHER'&&assets.some(asset=>String(asset.createdBy)!==String(request.auth.sub)))throw new AppError(403,'ATTACHMENT_OWNERSHIP','Teachers may attach only files they uploaded');
 return unique;
}
async function assignmentCreateData(request:any){const body={...(request.body??{})};if(request.auth?.role==='TEACHER'){if(!request.auth.profileId)throw new AppError(403,'TEACHER_PROFILE_REQUIRED','Teacher profile is required');body.teacherId=request.auth.profileId}body.attachments=await validateAssets(request,body.attachments,'assignment-attachment');delete body.schoolId;delete body.deletedAt;return body}
async function assignmentUpdateData(request:any){const body={...(request.body??{})};if(request.auth?.role==='TEACHER')delete body.teacherId;if(body.attachments!==undefined)body.attachments=await validateAssets(request,body.attachments,'assignment-attachment');delete body.schoolId;delete body.deletedAt;return body}
async function ownedAssignment(request:any,id:string){const scope=assignmentWriteScope(request);const item:any=await Assignment.findOne(Object.keys(scope).length?{$and:[{_id:id},scope]}:{_id:id});if(!item)throw new AppError(404,'NOT_FOUND','Assignment not found');return item}

export async function assignmentRoutes(app:FastifyInstance){
 await registerCrud(app,{prefix:'/api/assignments',model:Assignment,entity:'assignment',readPermission:PERMISSIONS.ASSIGNMENT_READ,writePermission:PERMISSIONS.ASSIGNMENT_WRITE,searchable:['title'],readScope:assignmentReadScope,writeScope:assignmentWriteScope,prepareCreate:assignmentCreateData,prepareUpdate:assignmentUpdateData});
 app.get('/api/assignments/:id/attachments/:assetId/download',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_READ)},async(request:any)=>{const assignment=await visibleAssignment(request,request.params.id);if(!(assignment.attachments||[]).map(String).includes(String(request.params.assetId)))throw new AppError(404,'NOT_FOUND','Assignment attachment not found');const download=await issueDomainAssetDownload(request.params.assetId,'assignment-attachment');return{success:true,data:{url:download.url,expiresIn:download.expiresIn,name:download.asset.originalName}}});
 app.post('/api/assignments/:id/submit',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_SUBMIT)},async(request:any)=>{const item:any=await visibleAssignment(request,request.params.id);const studentId=request.auth?.role==='STUDENT'?request.auth?.profileId:request.body?.studentId;if(!studentId)throw new AppError(403,'STUDENT_PROFILE_REQUIRED','Student profile is required');await assertStudentAccessible(request,studentId);const student:any=await Student.findById(studentId).select('classId sectionId').lean();if(!student||String(student.classId)!==String(item.classId)||String(student.sectionId)!==String(item.sectionId))throw new AppError(403,'ASSIGNMENT_SCOPE','Assignment is not published for this student section');const attachments=await validateAssets(request,request.body?.attachments,'assignment-submission');const late=item.dueAt&&new Date()>item.dueAt;const submission=await AssignmentSubmission.findOneAndUpdate({assignmentId:item._id,studentId},{$set:{text:String(request.body?.text||'').slice(0,20_000),attachments,submittedAt:new Date(),status:late?'LATE':'SUBMITTED'}},{new:true,upsert:true,setDefaultsOnInsert:true});return{success:true,data:submission}});
 app.get('/api/assignments/:id/my-submission',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_SUBMIT)},async(request:any)=>{if(request.auth?.role!=='STUDENT'||!request.auth?.profileId)throw new AppError(403,'STUDENT_PROFILE_REQUIRED','Student profile is required');await visibleAssignment(request,request.params.id);return{success:true,data:await AssignmentSubmission.findOne({assignmentId:request.params.id,studentId:request.auth.profileId}).lean()}});
 app.get('/api/assignments/:id/submissions',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_WRITE)},async(request:any)=>{await ownedAssignment(request,request.params.id);return{success:true,data:await AssignmentSubmission.find({assignmentId:request.params.id}).sort({submittedAt:-1}).lean()}});
 app.get('/api/assignments/:id/submissions/:submissionId/attachments/:assetId/download',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_WRITE)},async(request:any)=>{const assignment=await ownedAssignment(request,request.params.id);const submission:any=await AssignmentSubmission.findOne({_id:request.params.submissionId,assignmentId:assignment._id}).lean();if(!submission||(submission.attachments||[]).map(String).includes(String(request.params.assetId))===false)throw new AppError(404,'NOT_FOUND','Submission attachment not found');const download=await issueDomainAssetDownload(request.params.assetId,'assignment-submission');return{success:true,data:{url:download.url,expiresIn:download.expiresIn,name:download.asset.originalName}}});
 app.post('/api/assignments/:id/grade',{preHandler:requirePermission(PERMISSIONS.ASSIGNMENT_WRITE)},async(request:any)=>{const assignment=await ownedAssignment(request,request.params.id);const submission:any=await AssignmentSubmission.findOne({_id:request.body?.submissionId,assignmentId:assignment._id});if(!submission)throw new AppError(404,'NOT_FOUND','Assignment submission not found');const marks=Number(request.body?.marks);if(!Number.isFinite(marks)||marks<0)throw new AppError(400,'INVALID_MARKS','Marks must be a non-negative number');if(Number.isFinite(Number(assignment.maxMarks))&&marks>Number(assignment.maxMarks))throw new AppError(400,'INVALID_MARKS','Marks exceed the assignment maximum');submission.marks=marks;submission.feedback=String(request.body?.feedback||'').slice(0,5_000);submission.status='GRADED';await submission.save();return{success:true,data:submission}});
}
