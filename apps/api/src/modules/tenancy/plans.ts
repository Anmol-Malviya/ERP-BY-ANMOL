import { MODULES } from '@erp/contracts';
export type SchoolPlan='STARTER'|'GROWTH'|'PRO';
const STARTER=[
 'dashboard','students','teachers','staff','parents','admissions','academics','timetable','attendance','assignments','examinations','report-cards','leaves','communication','documents','notifications','settings'
] as const;
const GROWTH=[...STARTER,'fees','library','imports','analytics','audit','custom-forms'] as const;
export const PLAN_MODULES:Record<SchoolPlan,readonly string[]>={STARTER,GROWTH,PRO:MODULES};
export const PLAN_ORDER:SchoolPlan[]=['STARTER','GROWTH','PRO'];
export function normalizePlan(value:any):SchoolPlan{const plan=String(value||'STARTER').toUpperCase();if(!PLAN_ORDER.includes(plan as SchoolPlan))throw new Error('INVALID_PLAN');return plan as SchoolPlan}
export function modulesForPlan(plan:SchoolPlan){return [...PLAN_MODULES[plan]]}
export function validateEnabledModules(plan:SchoolPlan,value:any){if(!Array.isArray(value))throw new Error('INVALID_MODULES');const allowed=new Set(PLAN_MODULES[plan]),known=new Set(MODULES as readonly string[]),modules=[...new Set(value.map(String))];if(modules.some(item=>!known.has(item)))throw new Error('UNKNOWN_MODULE');if(modules.some(item=>!allowed.has(item)))throw new Error('MODULE_NOT_IN_PLAN');return modules}
export function clampModulesToPlan(plan:SchoolPlan,current:any){const allowed=new Set(PLAN_MODULES[plan]);return Array.isArray(current)?[...new Set(current.map(String))].filter(item=>allowed.has(item)):modulesForPlan(plan)}
