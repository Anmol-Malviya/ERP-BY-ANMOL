import { AppError } from '../../core/errors.js';
import { getTenantContext } from '../../core/tenant-context.js';
import { School } from './models.js';
export type LimitKey='students'|'staff'|'storageGb';
export async function getTenantLimits(){const schoolId=getTenantContext()?.schoolId;if(!schoolId)throw new AppError(403,'TENANT_REQUIRED','School context required');const school:any=await School.findById(schoolId).select('plan limits').lean();if(!school)throw new AppError(403,'SCHOOL_UNAVAILABLE','School is unavailable');return{schoolId,plan:String(school.plan),limits:{students:Number(school.limits?.students||0),staff:Number(school.limits?.staff||0),storageGb:Number(school.limits?.storageGb||0)}}}
export async function assertTenantLimit(key:LimitKey,current:number,increment=1){const{plan,limits}=await getTenantLimits(),limit=Number(limits[key]||0),next=current+increment;if(limit>0&&next>limit)throw new AppError(402,'TENANT_LIMIT_REACHED',`${key} capacity for the ${plan} plan has been reached`,{key,plan,current,requested:increment,limit});return{limit,next,plan}}
