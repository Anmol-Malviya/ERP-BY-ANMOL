import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export type EmailJob={to:string;subject:string;text?:string;html?:string;replyTo?:string;tags?:Record<string,string>};
export type FileScanJob={assetId:string;schoolId:string;bucket:string;key:string;contentType:string;size:number};
export type PaymentEventJob={eventId:string};
let redis:Redis|undefined,emailQueue:Queue<EmailJob>|undefined,fileScanQueue:Queue<FileScanJob>|undefined,paymentEventQueue:Queue<PaymentEventJob>|undefined,paymentReconcileQueue:Queue<Record<string,never>>|undefined;
function connection(){if(redis)return redis;redis=new Redis(env.REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false});redis.on('error',()=>undefined);return redis}
function emails(){return emailQueue??=new Queue<EmailJob>('erp:email',{connection:connection(),defaultJobOptions:{attempts:5,backoff:{type:'exponential',delay:2_000},removeOnComplete:500,removeOnFail:1_000}})}
function scans(){return fileScanQueue??=new Queue<FileScanJob>('erp:file-scan',{connection:connection(),defaultJobOptions:{attempts:4,backoff:{type:'exponential',delay:3_000},removeOnComplete:500,removeOnFail:2_000}})}
function paymentEvents(){return paymentEventQueue??=new Queue<PaymentEventJob>('erp:payment-event',{connection:connection(),defaultJobOptions:{attempts:8,backoff:{type:'exponential',delay:2_000},removeOnComplete:2_000,removeOnFail:5_000}})}
function paymentReconcile(){return paymentReconcileQueue??=new Queue<Record<string,never>>('erp:payment-reconcile',{connection:connection(),defaultJobOptions:{attempts:3,backoff:{type:'exponential',delay:5_000},removeOnComplete:100,removeOnFail:500}})}
export async function enqueueEmail(data:EmailJob){return emails().add('send',data)}
export async function enqueueFileScan(data:FileScanJob){return scans().add('scan',data,{jobId:`scan-${data.assetId}`})}
export async function enqueuePaymentEvent(data:PaymentEventJob){return paymentEvents().add('process',data,{jobId:`razorpay-${data.eventId}`})}
export async function ensureJobSchedulers(){await paymentReconcile().upsertJobScheduler('razorpay-reconciliation',{every:5*60_000},{name:'reconcile',data:{},opts:{attempts:3,backoff:{type:'exponential',delay:5_000},removeOnComplete:100,removeOnFail:500}})}
export async function closeQueues(){await Promise.all([emailQueue?.close(),fileScanQueue?.close(),paymentEventQueue?.close(),paymentReconcileQueue?.close()].filter(Boolean) as Promise<unknown>[]);if(redis&&redis.status!=='end')await redis.quit().catch(()=>undefined);emailQueue=undefined;fileScanQueue=undefined;paymentEventQueue=undefined;paymentReconcileQueue=undefined;redis=undefined}
