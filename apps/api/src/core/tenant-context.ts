import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext={
  schoolId?:string;
  userId?:string;
  isPlatform?:boolean;
  requestId?:string;
};

const storage=new AsyncLocalStorage<TenantContext>();

/**
 * Execute work inside a tenant scope and resolve Promise/thenable values before
 * leaving AsyncLocalStorage. Mongoose queries are lazy thenables, so returning
 * them directly can defer execution until after the tenant context has ended.
 */
export function runWithTenant<T>(context:TenantContext,fn:()=>T|PromiseLike<T>):Promise<T>{
  return storage.run(context,async()=>await fn());
}

export const enterTenantContext=(context:TenantContext)=>storage.enterWith(context);
export const getTenantContext=()=>storage.getStore();
