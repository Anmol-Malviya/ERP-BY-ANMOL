import { Types } from 'mongoose';
import { AppError } from '../../core/errors.js';
import { TeacherSubjectMap } from '../academics/models.js';
import { Guardian,Student } from './models.js';
const EMPTY_IDS:Types.ObjectId[]=[];
const oid=(value:any)=>Types.ObjectId.isValid(String(value||''))?new Types.ObjectId(String(value)):null;
export async function accessibleStudentIds(request:any):Promise<Types.ObjectId[]|null>{
 const role=request.auth?.role,profileId=oid(request.auth?.profileId);
 if(role==='STUDENT')return profileId?[profileId]:EMPTY_IDS;
 if(role==='PARENT'){
  if(!profileId)return EMPTY_IDS;
  const guardian:any=await Guardian.findById(profileId).select('studentIds').lean();
  return (guardian?.studentIds||[]).map((id:any)=>oid(id)).filter(Boolean) as Types.ObjectId[];
 }
 if(role==='TEACHER'){
  if(!profileId)return EMPTY_IDS;
  const sectionIds=await TeacherSubjectMap.distinct('sectionId',{teacherId:profileId});
  if(!sectionIds.length)return EMPTY_IDS;
  return await Student.distinct('_id',{sectionId:{$in:sectionIds}}) as Types.ObjectId[];
 }
 return null;
}
export async function studentReadScope(request:any){const ids=await accessibleStudentIds(request);return ids===null?{}:{_id:{$in:ids}}}
export async function relatedStudentReadScope(request:any,field='studentId'){const ids=await accessibleStudentIds(request);return ids===null?{}:{[field]:{$in:ids}}}
export async function guardianReadScope(request:any){const role=request.auth?.role,profileId=oid(request.auth?.profileId);if(role==='PARENT')return profileId?{_id:profileId}:{_id:{$in:EMPTY_IDS}};if(role==='STUDENT'){if(!profileId)return{_id:{$in:EMPTY_IDS}};const student:any=await Student.findById(profileId).select('guardianIds').lean();return{_id:{$in:student?.guardianIds||EMPTY_IDS}}}if(role==='TEACHER'){const ids=await accessibleStudentIds(request);return ids===null?{}:{studentIds:{$in:ids}}}if(role==='LIBRARIAN')return{_id:{$in:EMPTY_IDS}};return{}}
export function studentReadProjection(request:any){const role=request.auth?.role;if(role==='LIBRARIAN')return'firstName lastName admissionNo rollNo classId sectionId photoUrl status lifecycle';if(role==='TEACHER')return'firstName lastName admissionNo rollNo classId sectionId photoUrl lifecycle';return undefined}
export async function assertStudentAccessible(request:any,studentId:any){const ids=await accessibleStudentIds(request);if(ids===null)return;const target=String(studentId||'');if(!ids.some(id=>String(id)===target))throw new AppError(404,'NOT_FOUND','Student record not found')}
export async function assertStudentsAccessible(request:any,studentIds:any[]){const ids=await accessibleStudentIds(request);if(ids===null)return;const allowed=new Set(ids.map(String));if(studentIds.some(id=>!allowed.has(String(id))))throw new AppError(403,'STUDENT_SCOPE_DENIED','One or more student records are outside your assigned scope')}
