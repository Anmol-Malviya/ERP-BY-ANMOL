import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection=new Redis(process.env.REDIS_URL||'redis://localhost:6379',{maxRetriesPerRequest:null});
const nodeEnv=process.env.NODE_ENV||'development';

type EmailJob={to:string;subject:string;text?:string;html?:string;replyTo?:string;tags?:Record<string,string>};

async function sendEmail(data:EmailJob){
  if(!data?.to||!data?.subject||(!data.text&&!data.html))throw new Error('Invalid email job payload');
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.EMAIL_FROM||'ERP BY ANMOL <no-reply@example.com>';
  if(!apiKey){
    if(nodeEnv==='production')throw new Error('RESEND_API_KEY is required for production email delivery');
    console.log(`[email:development] ${data.to} | ${data.subject}`);
    return{simulated:true};
  }
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from,to:[data.to],subject:data.subject,text:data.text,html:data.html,reply_to:data.replyTo,
      tags:data.tags?Object.entries(data.tags).map(([name,value])=>({name,value})):undefined
    })
  });
  const body=await response.text();
  if(!response.ok)throw new Error(`Email provider rejected request (${response.status}): ${body.slice(0,300)}`);
  return JSON.parse(body) as unknown;
}

async function developmentOnlyProcessor(kind:string,data:any){
  if(nodeEnv==='production')throw new Error(`${kind} provider/processor is not configured for production`);
  console.log(`[${kind}:development] job received`,data?.id||data?.type||'');
  return{simulated:true,kind};
}

const processors:Record<string,(data:any)=>Promise<unknown>>={
  email:sendEmail,
  pdf:data=>developmentOnlyProcessor('pdf',data),
  import:data=>developmentOnlyProcessor('import',data),
  report:data=>developmentOnlyProcessor('report',data)
};

const workers=Object.entries(processors).map(([name,processor])=>{
  const worker=new Worker(`erp:${name}`,job=>processor(job.data),{connection,concurrency:name==='email'?10:3});
  worker.on('completed',job=>console.log(`[${name}] job ${job.id} completed`));
  worker.on('failed',(job,error)=>console.error(`[${name}] job ${job?.id} failed`,error));
  return worker;
});

async function shutdown(signal:string){
  console.log(`ERP workers shutting down (${signal})`);
  await Promise.all(workers.map(worker=>worker.close()));
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM',()=>void shutdown('SIGTERM'));
process.on('SIGINT',()=>void shutdown('SIGINT'));
console.log('ERP workers online: email, pdf, import, report');
