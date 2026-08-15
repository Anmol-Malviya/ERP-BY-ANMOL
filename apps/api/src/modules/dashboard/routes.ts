import type { FastifyInstance } from 'fastify';
import { Student,Teacher,Staff,Guardian } from '../people/models.js';
import { Admission } from '../admissions/models.js';
import { Attendance } from '../attendance/models.js';
import { Assignment,AssignmentSubmission } from '../assignments/models.js';
import { TimetableSlot } from '../timetable/models.js';
import { Exam } from '../examinations/models.js';
import { ReportCard } from '../report-cards/models.js';
import { FeeInvoice,FeePayment } from '../fees/models.js';
import { LibraryBook,BookIssue } from '../library/models.js';
import { Payroll } from '../payroll/models.js';
import { LeaveRequest } from '../leaves/models.js';
import { Notice } from '../communication/models.js';

const money=(value:number)=>Math.round(value*100)/100;
const card=(label:string,value:string|number,note:string)=>({label,value:String(value),note});

export async function dashboardRoutes(app:FastifyInstance){
 app.get('/api/dashboard/overview',async(request:any)=>{
   const role=String(request.auth?.role||'');
   const profileId=request.auth?.profileId;
   const notices=await Notice.countDocuments({status:'PUBLISHED'});

   if(role==='STUDENT'&&profileId){
     const student=await Student.findById(profileId).lean();
     if(!student)return{success:true,data:{role,cards:[card('Profile','Unavailable','Link student profile to this login')]}};
     const [attendance,assignments,reports,feeAgg]=await Promise.all([
       Attendance.aggregate([{$match:{studentId:student._id}},{$group:{_id:'$status',count:{$sum:1}}}]),
       Assignment.countDocuments({classId:student.classId,sectionId:student.sectionId,published:true}),
       ReportCard.countDocuments({studentId:student._id}),
       FeeInvoice.aggregate([{$match:{studentId:student._id,status:{$nin:['CANCELLED','PAID']}}},{$group:{_id:null,balance:{$sum:'$balance'}}}])
     ]);
     const total=attendance.reduce((n:any,x:any)=>n+x.count,0),present=attendance.find((x:any)=>x._id==='PRESENT')?.count||0;
     return{success:true,data:{role,name:`${student.firstName} ${student.lastName||''}`.trim(),cards:[card('Attendance',total?`${Math.round(present/total*100)}%`:'—','Recorded attendance'),card('Assignments',assignments,'Published for your class'),card('Report cards',reports,'Generated results'),card('Fee balance',`₹${money(feeAgg[0]?.balance||0).toLocaleString('en-IN')}`,'Outstanding dues')],notices}};
   }

   if(role==='PARENT'&&profileId){
     const guardian=await Guardian.findById(profileId).lean();
     const ids=(guardian?.studentIds||[]) as any[];
     const [students,feeAgg,reports]=await Promise.all([Student.countDocuments({_id:{$in:ids}}),FeeInvoice.aggregate([{$match:{studentId:{$in:ids},status:{$nin:['CANCELLED','PAID']}}},{$group:{_id:null,balance:{$sum:'$balance'}}}]),ReportCard.countDocuments({studentId:{$in:ids}})]);
     return{success:true,data:{role,cards:[card('Linked students',students,'Children in this school'),card('Fee balance',`₹${money(feeAgg[0]?.balance||0).toLocaleString('en-IN')}`,'Across linked students'),card('Published reports',reports,'Available report cards'),card('Notices',notices,'Published school notices')]}};
   }

   if(role==='TEACHER'&&profileId){
     const now=new Date(),day=((now.getDay()+6)%7)+1;
     const [classes,assignments,submissions,leaves]=await Promise.all([TimetableSlot.countDocuments({teacherId:profileId,day,published:true}),Assignment.countDocuments({teacherId:profileId}),AssignmentSubmission.countDocuments({status:{$in:['SUBMITTED','LATE']}}),LeaveRequest.countDocuments({applicantType:'TEACHER',applicantId:profileId,status:'PENDING'})]);
     return{success:true,data:{role,cards:[card('Today’s periods',classes,'Published timetable'),card('Assignments',assignments,'Created by you'),card('Submissions',submissions,'Awaiting grading'),card('Leave requests',leaves,'Your pending requests')],notices}};
   }

   if(role==='ACCOUNTS_MANAGER'){
     const [feeAgg,payments]=await Promise.all([FeeInvoice.aggregate([{$group:{_id:null,total:{$sum:'$total'},paid:{$sum:'$paid'},balance:{$sum:'$balance'}}}]),FeePayment.countDocuments({status:'SUCCESS'})]);const f=feeAgg[0]||{};
     return{success:true,data:{role,cards:[card('Billed',`₹${money(f.total||0).toLocaleString('en-IN')}`,'All invoices'),card('Collected',`₹${money(f.paid||0).toLocaleString('en-IN')}`,'Recorded payments'),card('Outstanding',`₹${money(f.balance||0).toLocaleString('en-IN')}`,'Open balance'),card('Receipts',payments,'Successful payments')]}};
   }

   if(role==='HR_MANAGER'){
     const [teachers,staff,payroll,leaves]=await Promise.all([Teacher.countDocuments(),Staff.countDocuments(),Payroll.countDocuments({status:{$in:['DRAFT','APPROVED']}}),LeaveRequest.countDocuments({applicantType:{$in:['TEACHER','STAFF']},status:'PENDING'})]);
     return{success:true,data:{role,cards:[card('Teachers',teachers,'Active faculty records'),card('Staff',staff,'Non-teaching records'),card('Payroll runs',payroll,'Draft or approved'),card('Pending leaves',leaves,'Needs HR decision')]}};
   }

   if(role==='EXAM_CONTROLLER'){
     const [draft,entry,published,reports]=await Promise.all([Exam.countDocuments({status:'DRAFT'}),Exam.countDocuments({status:'MARKS_ENTRY'}),Exam.countDocuments({status:'PUBLISHED'}),ReportCard.countDocuments()]);
     return{success:true,data:{role,cards:[card('Draft exams',draft,'Configuration stage'),card('Marks entry',entry,'Open for marks'),card('Published exams',published,'Visible results'),card('Report cards',reports,'Generated records')]}};
   }

   if(role==='LIBRARIAN'){
     const [books,available,issued,overdue]=await Promise.all([LibraryBook.countDocuments(),LibraryBook.countDocuments({status:'AVAILABLE'}),BookIssue.countDocuments({status:'ISSUED'}),BookIssue.countDocuments({status:'OVERDUE'})]);
     return{success:true,data:{role,cards:[card('Books',books,'Catalogue copies'),card('Available',available,'Ready to issue'),card('Issued',issued,'Currently borrowed'),card('Overdue',overdue,'Needs follow-up')]}};
   }

   if(role==='ADMISSION_MANAGER'){
     const [applied,review,accepted,admitted]=await Promise.all([Admission.countDocuments({status:'APPLIED'}),Admission.countDocuments({status:{$in:['DOCUMENT_VERIFICATION','UNDER_REVIEW']}}),Admission.countDocuments({status:'ACCEPTED'}),Admission.countDocuments({status:'ADMITTED'})]);
     return{success:true,data:{role,cards:[card('Applications',applied,'New applications'),card('In review',review,'Verification pipeline'),card('Accepted',accepted,'Ready to admit'),card('Admitted',admitted,'Converted to student')]}};
   }

   const [students,teachers,staff,admissions,pendingLeaves,feeAgg]=await Promise.all([Student.countDocuments(),Teacher.countDocuments(),Staff.countDocuments(),Admission.countDocuments({status:{$in:['APPLIED','UNDER_REVIEW','DOCUMENT_VERIFICATION']}}),LeaveRequest.countDocuments({status:'PENDING'}),FeeInvoice.aggregate([{$group:{_id:null,total:{$sum:'$total'},paid:{$sum:'$paid'},balance:{$sum:'$balance'}}}])]);
   const fees=feeAgg[0]||{total:0,paid:0,balance:0};
   return{success:true,data:{role,cards:[card('Active students',students,'Current tenant'),card('Teachers',teachers,'Faculty records'),card('Pending admissions',admissions,'Needs review'),card('Outstanding fees',`₹${money(fees.balance||0).toLocaleString('en-IN')}`,'Student invoices')],secondary:{staff,pendingLeaves,fees,notices}}};
 });
}
