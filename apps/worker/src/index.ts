import { Worker } from 'bullmq';import IORedis from 'ioredis';
const connection=new IORedis(process.env.REDIS_URL||'redis://localhost:6379',{maxRetriesPerRequest:null});
const processors:Record<string,(data:any)=>Promise<any>>={
 email:async data=>({accepted:true,kind:'email',data}),
 pdf:async data=>({accepted:true,kind:'pdf',data}),
 import:async data=>({accepted:true,kind:'import',data}),
 report:async data=>({accepted:true,kind:'report',data})
};
for(const name of Object.keys(processors)){const worker=new Worker(`erp:${name}`,job=>processors[name](job.data),{connection,concurrency:name==='email'?10:3});worker.on('failed',(job,error)=>console.error(`[${name}] job ${job?.id} failed`,error))}
console.log('ERP workers online: email, pdf, import, report');
