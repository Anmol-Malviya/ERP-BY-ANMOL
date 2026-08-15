import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@erp/contracts';
import { requirePermission } from '../../core/security.js';
import { Student,Teacher } from '../people/models.js';
import { getTenantContext } from '../../core/tenant-context.js';
import { AppError } from '../../core/errors.js';

type ImportType='students'|'teachers';
const allowed=new Set<ImportType>(['students','teachers']);

function validateRows(type:ImportType,rows:any[]){
  const errors:Array<{row:number;field:string;message:string}>=[];
  rows.forEach((row,index)=>{
    if(!String(row?.firstName||'').trim())errors.push({row:index+1,field:'firstName',message:'Required'});
    if(type==='students'&&!String(row?.admissionNo||'').trim())errors.push({row:index+1,field:'admissionNo',message:'Required'});
    if(type==='teachers'&&!String(row?.employeeNo||'').trim())errors.push({row:index+1,field:'employeeNo',message:'Required'});
  });
  return errors;
}

export async function importRoutes(app:FastifyInstance){
  app.post('/api/imports/preview',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{
    const{type,rows}=request.body??{};
    if(!allowed.has(type as ImportType)||!Array.isArray(rows))throw new AppError(400,'INVALID_INPUT','Supported import types are students and teachers');
    if(rows.length>5_000)throw new AppError(413,'IMPORT_TOO_LARGE','A single synchronous import is limited to 5,000 rows');
    const errors=validateRows(type as ImportType,rows);
    return{success:true,data:{valid:errors.length===0,total:rows.length,errors}};
  });

  app.post('/api/imports/commit',{preHandler:requirePermission(PERMISSIONS.IMPORT_RUN)},async(request:any)=>{
    const{type,rows}=request.body??{};
    if(!allowed.has(type as ImportType)||!Array.isArray(rows))throw new AppError(400,'INVALID_INPUT','Invalid import payload');
    if(rows.length>5_000)throw new AppError(413,'IMPORT_TOO_LARGE','A single synchronous import is limited to 5,000 rows');
    const errors=validateRows(type as ImportType,rows);
    if(errors.length)throw new AppError(422,'IMPORT_VALIDATION_FAILED','Import contains invalid rows',errors.slice(0,200));
    const schoolId=getTenantContext()?.schoolId;
    if(!schoolId)throw new Error('Tenant context missing');
    const safeRows=rows.map((row:any)=>({...row,schoolId,deletedAt:null}));
    const inserted=type==='students'
      ?await Student.insertMany(safeRows,{ordered:false})
      :await Teacher.insertMany(safeRows,{ordered:false});
    return{success:true,data:{inserted:inserted.length}};
  });
}
