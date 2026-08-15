import { AsyncLocalStorage } from 'node:async_hooks';
export type TenantContext={schoolId?:string;userId?:string;isPlatform?:boolean;requestId?:string};
const storage=new AsyncLocalStorage<TenantContext>();
export const runWithTenant=<T>(context:TenantContext,fn:()=>T)=>storage.run(context,fn);
export const enterTenantContext=(context:TenantContext)=>storage.enterWith(context);
export const getTenantContext=()=>storage.getStore();
