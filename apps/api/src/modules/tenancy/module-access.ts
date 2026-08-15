import type { FastifyRequest } from 'fastify';
import { AppError } from '../../core/errors.js';
import { School } from './models.js';

type CacheEntry={status:string;enabled:Set<string>;expiresAt:number};
const cache=new Map<string,CacheEntry>();
const TTL_MS=30_000;

const routeModules:[RegExp,string][]=[
  [/^\/api\/dashboard(?:\/|$)/,'dashboard'],
  [/^\/api\/students(?:\/|$)/,'students'],
  [/^\/api\/guardians(?:\/|$)/,'parents'],
  [/^\/api\/teachers(?:\/|$)/,'teachers'],
  [/^\/api\/staff(?:\/|$)/,'staff'],
  [/^\/api\/admissions(?:\/|$)/,'admissions'],
  [/^\/api\/custom-(?:forms|form-submissions)(?:\/|$)/,'custom-forms'],
  [/^\/api\/academics(?:\/|$)/,'academics'],
  [/^\/api\/timetable(?:\/|$)/,'timetable'],
  [/^\/api\/(?:attendance|faculty-attendance)(?:\/|$)/,'attendance'],
  [/^\/api\/assignments(?:\/|$)/,'assignments'],
  [/^\/api\/exams(?:\/|$)/,'examinations'],
  [/^\/api\/(?:report-templates|report-cards)(?:\/|$)/,'report-cards'],
  [/^\/api\/fees(?:\/|$)/,'fees'],
  [/^\/api\/library(?:\/|$)/,'library'],
  [/^\/api\/payroll(?:\/|$)/,'payroll'],
  [/^\/api\/leaves(?:\/|$)/,'leaves'],
  [/^\/api\/(?:notices|grievances|chat(?:-messages|\/contacts)?|knowledge)(?:\/|$)/,'communication'],
  [/^\/api\/(?:document-templates|documents)(?:\/|$)/,'documents'],
  [/^\/api\/imports(?:\/|$)/,'imports'],
  [/^\/api\/notifications(?:\/|$)/,'notifications'],
  [/^\/api\/analytics(?:\/|$)/,'analytics'],
  [/^\/api\/settings(?:\/|$)/,'settings'],
  [/^\/api\/biometric(?:\/|$)/,'biometric'],
  [/^\/api\/oases(?:\/|$)/,'oases'],
  [/^\/api\/audit(?:\/|$)/,'audit']
];

function moduleFor(url:string){return routeModules.find(([pattern])=>pattern.test(url))?.[1]}

async function getSchoolAccess(schoolId:string){
  const current=cache.get(schoolId);
  if(current&&current.expiresAt>Date.now())return current;
  const school=await School.findById(schoolId).select('status enabledModules').lean();
  if(!school)throw new AppError(403,'SCHOOL_UNAVAILABLE','School is unavailable');
  const next={status:String(school.status),enabled:new Set((school.enabledModules||[]).map(String)),expiresAt:Date.now()+TTL_MS};
  cache.set(schoolId,next);return next;
}

export async function enforceSchoolAccess(request:FastifyRequest){
  const schoolId=request.auth?.schoolId;if(!schoolId)return;
  const access=await getSchoolAccess(schoolId);
  if(access.status==='SUSPENDED')throw new AppError(403,'SCHOOL_SUSPENDED','School access is suspended');
  const moduleKey=moduleFor(request.url);
  if(moduleKey&&!access.enabled.has(moduleKey))throw new AppError(403,'MODULE_DISABLED',`${moduleKey} module is disabled for this school`);
}

export function invalidateSchoolAccess(schoolId:string){cache.delete(schoolId)}
