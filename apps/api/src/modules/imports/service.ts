import { AcademicClass,Section } from '../academics/models.js';
import { Student,Teacher } from '../people/models.js';

export type ImportType='students'|'teachers';
export type RowEnvelope={row:number;data:Record<string,unknown>};
export type RowIssue={row:number;field:string;message:string};
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genders=new Set(['MALE','FEMALE','OTHER']);
const studentLifecycle=new Set(['ACTIVE','SUSPENDED','DROPPED','PASSED','ALUMNI']);
const clean=(value:any,max=200)=>{const text=String(value??'').trim();return text?text.slice(0,max):undefined};
const issue=(row:number,field:string,message:string):RowIssue=>({row,field,message});
function dateValue(value:any){if(value===undefined||value===null||String(value).trim()==='')return undefined;const date=new Date(value);return Number.isNaN(date.getTime())?null:date}

export async function prepareStudentRows(rows:RowEnvelope[]){
 const errors:RowIssue[]=[],prepared:any[]=[];
 const admissionNos=rows.map(item=>clean(item.data.admissionNo,80)).filter(Boolean) as string[];
 const existing=new Set((await Student.find({admissionNo:{$in:admissionNos}}).select('admissionNo').lean()).map((item:any)=>String(item.admissionNo).toLowerCase()));
 const seen=new Set<string>();
 const classNames=[...new Set(rows.map(item=>clean(item.data.className,80)).filter(Boolean) as string[])];
 const classes=classNames.length?await AcademicClass.find({name:{$in:classNames}}).select('_id name').lean():[];
 const classMap=new Map(classes.map((item:any)=>[String(item.name).toLowerCase(),item._id]));
 const sectionNames=[...new Set(rows.map(item=>clean(item.data.sectionName,80)).filter(Boolean) as string[])];
 const sections=sectionNames.length?await Section.find({name:{$in:sectionNames}}).select('_id name classId').lean():[];
 for(const item of rows){
  const data=item.data,row=item.row,firstName=clean(data.firstName,100),admissionNo=clean(data.admissionNo,80);
  if(!firstName){errors.push(issue(row,'firstName','Required'));continue}if(!admissionNo){errors.push(issue(row,'admissionNo','Required'));continue}
  const key=admissionNo.toLowerCase();if(seen.has(key)||existing.has(key)){errors.push(issue(row,'admissionNo','Duplicate admission number'));continue}seen.add(key);
  const email=clean(data.email,180)?.toLowerCase();if(email&&!emailPattern.test(email)){errors.push(issue(row,'email','Invalid email'));continue}
  const gender=clean(data.gender,20)?.toUpperCase();if(gender&&!genders.has(gender)){errors.push(issue(row,'gender','Use MALE, FEMALE or OTHER'));continue}
  const dob=dateValue(data.dateOfBirth),admissionDate=dateValue(data.admissionDate);if(dob===null){errors.push(issue(row,'dateOfBirth','Invalid date'));continue}if(admissionDate===null){errors.push(issue(row,'admissionDate','Invalid date'));continue}
  const className=clean(data.className,80),sectionName=clean(data.sectionName,80);let classId:any=undefined,sectionId:any=undefined;
  if(className){classId=classMap.get(className.toLowerCase());if(!classId){errors.push(issue(row,'className','Class not found'));continue}}
  if(sectionName){const match=sections.find((section:any)=>String(section.name).toLowerCase()===sectionName.toLowerCase()&&(!classId||String(section.classId)===String(classId)));if(!match){errors.push(issue(row,'sectionName','Section not found for the selected class'));continue}sectionId=match._id;if(!classId)classId=match.classId}
  const lifecycle=clean(data.lifecycle,30)?.toUpperCase();if(lifecycle&&!studentLifecycle.has(lifecycle)){errors.push(issue(row,'lifecycle','Invalid lifecycle value'));continue}
  prepared.push({firstName,lastName:clean(data.lastName,100)||'',email,phone:clean(data.phone,40),dateOfBirth:dob||undefined,gender,admissionNo,rollNo:clean(data.rollNo,80),classId,sectionId,admissionDate:admissionDate||undefined,status:clean(data.status,30)||'ACTIVE',lifecycle:lifecycle||'ACTIVE'});
 }
 return{prepared,errors};
}

export async function prepareTeacherRows(rows:RowEnvelope[]){
 const errors:RowIssue[]=[],prepared:any[]=[];
 const employeeNos=rows.map(item=>clean(item.data.employeeNo,80)).filter(Boolean) as string[];
 const existing=new Set((await Teacher.find({employeeNo:{$in:employeeNos}}).select('employeeNo').lean()).map((item:any)=>String(item.employeeNo).toLowerCase()));
 const seen=new Set<string>();
 for(const item of rows){
  const data=item.data,row=item.row,firstName=clean(data.firstName,100),employeeNo=clean(data.employeeNo,80);
  if(!firstName){errors.push(issue(row,'firstName','Required'));continue}if(!employeeNo){errors.push(issue(row,'employeeNo','Required'));continue}
  const key=employeeNo.toLowerCase();if(seen.has(key)||existing.has(key)){errors.push(issue(row,'employeeNo','Duplicate employee number'));continue}seen.add(key);
  const email=clean(data.email,180)?.toLowerCase();if(email&&!emailPattern.test(email)){errors.push(issue(row,'email','Invalid email'));continue}
  const gender=clean(data.gender,20)?.toUpperCase();if(gender&&!genders.has(gender)){errors.push(issue(row,'gender','Use MALE, FEMALE or OTHER'));continue}
  const dob=dateValue(data.dateOfBirth),joiningDate=dateValue(data.joiningDate);if(dob===null){errors.push(issue(row,'dateOfBirth','Invalid date'));continue}if(joiningDate===null){errors.push(issue(row,'joiningDate','Invalid date'));continue}
  prepared.push({firstName,lastName:clean(data.lastName,100)||'',email,phone:clean(data.phone,40),dateOfBirth:dob||undefined,gender,employeeNo,department:clean(data.department,120),qualification:clean(data.qualification,180),joiningDate:joiningDate||undefined,status:clean(data.status,30)||'ACTIVE'});
 }
 return{prepared,errors};
}
