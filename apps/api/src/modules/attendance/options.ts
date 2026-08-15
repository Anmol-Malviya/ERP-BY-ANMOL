import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@erp/contracts';
import { AppError } from '../../core/errors.js';
import { requirePermission } from '../../core/security.js';
import { AcademicClass,AcademicSession,Section,Subject,TeacherSubjectMap } from '../academics/models.js';
import { Teacher } from '../people/models.js';

export async function registerAttendanceOptions(app:FastifyInstance){
 app.get('/api/attendance/marking-options',{preHandler:requirePermission(PERMISSIONS.ATTENDANCE_MARK)},async(request:any)=>{
  const sessions=await AcademicSession.find().select('name startDate endDate isCurrent').sort({startDate:-1}).lean();
  if(request.auth?.role==='TEACHER'){
   const teacherId=request.auth?.profileId;if(!teacherId)throw new AppError(403,'PROFILE_REQUIRED','Teacher profile is required');
   const[teacher,maps]=await Promise.all([Teacher.findById(teacherId).select('classTeacherOf').lean(),TeacherSubjectMap.find({teacherId}).populate('classId','name').populate('sectionId','name classId').populate('subjectId','name code').lean()]);
   let dailySections:any[]=[];if((teacher as any)?.classTeacherOf){const section:any=await Section.findById((teacher as any).classTeacherOf).populate('classId','name').select('name classId').lean();if(section)dailySections=[section]}
   return{success:true,data:{sessions,mode:'TEACHER',assignments:maps.map((map:any)=>({id:map._id,classId:map.classId?._id,className:map.classId?.name,sectionId:map.sectionId?._id,sectionName:map.sectionId?.name,subjectId:map.subjectId?._id,subjectName:map.subjectId?.name,subjectCode:map.subjectId?.code})),dailySections:dailySections.map((section:any)=>({sectionId:section._id,sectionName:section.name,classId:section.classId?._id,className:section.classId?.name}))}};
  }
  const[classes,sections,subjects]=await Promise.all([AcademicClass.find().select('name order').sort({order:1,name:1}).lean(),Section.find().select('name classId room').sort({name:1}).lean(),Subject.find().select('name code type').sort({name:1}).lean()]);return{success:true,data:{sessions,mode:'ADMIN',classes,sections,subjects}};
 });
}
