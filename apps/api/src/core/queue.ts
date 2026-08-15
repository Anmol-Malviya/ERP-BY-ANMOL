import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
export type EmailJob={to:string;subject:string;text?:string;html?:string;replyTo?:string;tags?:Record<string,string>};
let redis:IORedis|undefined;let emailQueue:Queue<EmailJob>|undefined;
function getEmailQueue(){if(emailQueue)return emailQueue;redis=new IORedis(env.REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false});redis.on('error',()=>undefined);emailQueue=new Queue<EmailJob>('erp:email',{connection:redis,defaultJobOptions:{attempts:5,backoff:{type:'exponential',delay:2_000},removeOnComplete:500,removeOnFail:1_000}});return emailQueue}
export async function enqueueEmail(data:EmailJob){return getEmailQueue().add('send',data)}
export async function closeQueues(){if(emailQueue)await emailQueue.close();if(redis&&redis.status!=='end')await redis.quit().catch(()=>undefined);emailQueue=undefined;redis=undefined}
