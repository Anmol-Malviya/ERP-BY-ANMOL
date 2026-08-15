import type { FastifyInstance } from 'fastify';
import { createHash,timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError,forbidden } from '../../core/errors.js';
import { enqueuePaymentEvent } from '../../core/queue.js';
import { ProviderWebhookEvent } from './models.js';
import { processProviderWebhookEvent,reconcilePendingProviderState } from './reconciliation.js';
import { verifyWebhookSignature } from './razorpay.js';

function ids(body:any){const payment=body?.payload?.payment?.entity,refund=body?.payload?.refund?.entity,order=body?.payload?.order?.entity;return{providerPaymentId:payment?.id,providerOrderId:payment?.order_id||order?.id,providerRefundId:refund?.id}}
function validWorkerSecret(value:any){const a=Buffer.from(String(value||'')),b=Buffer.from(env.WORKER_CALLBACK_SECRET);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)}

export function registerRazorpayWebhook(app:FastifyInstance){
 app.register((scope,_options,done)=>{
  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:1024*1024},(_request,body,callback)=>callback(null,body));
  scope.post('/api/webhooks/razorpay',async(request:any,reply)=>{const raw=Buffer.isBuffer(request.body)?request.body:Buffer.from(request.body||'');const signature=String(request.headers['x-razorpay-signature']||''),eventId=String(request.headers['x-razorpay-event-id']||'').trim();if(!eventId||eventId.length>200)throw new AppError(400,'INVALID_WEBHOOK_EVENT','Webhook event id is required');if(!verifyWebhookSignature(raw,signature))throw new AppError(400,'INVALID_WEBHOOK_SIGNATURE','Webhook signature verification failed');let body:any;try{body=JSON.parse(raw.toString('utf8'))}catch{throw new AppError(400,'INVALID_WEBHOOK_BODY','Webhook body is not valid JSON')};const eventType=String(body?.event||'');if(!eventType)throw new AppError(400,'INVALID_WEBHOOK_BODY','Webhook event type is missing');const bodyHash=createHash('sha256').update(raw).digest('hex'),providerIds=ids(body);let event:any=await ProviderWebhookEvent.findOne({provider:'RAZORPAY',eventId});if(event&&event.bodyHash!==bodyHash)throw new AppError(409,'WEBHOOK_EVENT_CONFLICT','Webhook event id was reused with different content');if(!event){try{event=await ProviderWebhookEvent.create({provider:'RAZORPAY',eventId,eventType,bodyHash,...providerIds,status:'RECEIVED'})}catch(error:any){if(error?.code!==11000)throw error;event=await ProviderWebhookEvent.findOne({provider:'RAZORPAY',eventId})}}if(!event)throw new AppError(500,'WEBHOOK_STORE_FAILED','Webhook event could not be persisted');if(['PROCESSED','IGNORED','PROCESSING'].includes(event.status))return reply.code(200).send({success:true});try{await enqueuePaymentEvent({eventId})}catch(error){event.status='FAILED';event.failureReason='Webhook persisted but could not be queued';event.updatedAt=new Date();await event.save();throw new AppError(503,'WEBHOOK_QUEUE_UNAVAILABLE','Webhook could not be queued for processing')};return reply.code(200).send({success:true})});
  done();
 });
}

export async function internalPaymentRoutes(app:FastifyInstance){
 app.post('/api/internal/payments/webhook/process',async(request:any)=>{if(!validWorkerSecret(request.headers['x-worker-secret']))throw forbidden('Invalid worker credentials');const eventId=String(request.body?.eventId||'');if(!eventId)throw new AppError(400,'INVALID_INPUT','eventId is required');return{success:true,data:await processProviderWebhookEvent(eventId)}});
 app.post('/api/internal/payments/reconcile',async(request:any)=>{if(!validWorkerSecret(request.headers['x-worker-secret']))throw forbidden('Invalid worker credentials');return{success:true,data:await reconcilePendingProviderState(Number(request.body?.limit||50))}});
}
