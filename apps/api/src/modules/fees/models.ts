import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const FeeStructureSchema=new Schema({
  name:{type:String,required:true},sessionId:{type:Schema.Types.ObjectId,ref:'AcademicSession',required:true},classId:{type:Schema.Types.ObjectId,ref:'AcademicClass'},
  items:[{head:String,amount:Number,frequency:String}],dueRules:Schema.Types.Mixed,createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
FeeStructureSchema.plugin(tenantPlugin);

const FeeInvoiceSchema=new Schema({
  invoiceNo:{type:String,required:true},studentId:{type:Schema.Types.ObjectId,ref:'Student',required:true,index:true},
  items:[{head:String,amount:Number,discount:Number,fine:Number}],subtotal:Number,discount:Number,fine:Number,total:{type:Number,required:true,min:0},
  paid:{type:Number,default:0,min:0},balance:{type:Number,required:true,min:0},reserved:{type:Number,default:0,min:0},currency:{type:String,default:'INR'},
  appliedPaymentKeys:[{type:String}],reservationKeys:[{type:String}],dueDate:Date,status:{type:String,enum:['DRAFT','DUE','PARTIAL','PAID','CANCELLED'],default:'DUE',index:true},
  createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
FeeInvoiceSchema.plugin(tenantPlugin);
FeeInvoiceSchema.index({schoolId:1,invoiceNo:1},{unique:true,partialFilterExpression:{deletedAt:null}});

const FeePaymentSchema=new Schema({
  receiptNo:{type:String,required:true},idempotencyKey:{type:String,required:true},invoiceId:{type:Schema.Types.ObjectId,ref:'FeeInvoice',required:true,index:true},studentId:{type:Schema.Types.ObjectId,ref:'Student',required:true,index:true},
  amount:{type:Number,required:true,min:0.01},currency:{type:String,default:'INR'},mode:{type:String,enum:['CASH','UPI','CARD','BANK','RAZORPAY'],required:true},reference:String,
  provider:{type:String,enum:['RAZORPAY']},providerOrderId:String,providerPaymentId:String,providerStatus:String,lastProviderSyncAt:Date,
  status:{type:String,enum:['PENDING','SUCCESS','FAILED','REFUNDED','PARTIALLY_REFUNDED'],default:'PENDING',index:true},failureReason:String,
  refundReserved:{type:Number,default:0,min:0},refundedAmount:{type:Number,default:0,min:0},refundReservationKeys:[{type:String}],paidAt:Date,
  createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now},collectedBy:{type:Schema.Types.ObjectId,ref:'User'}
},{versionKey:false});
FeePaymentSchema.plugin(tenantPlugin);
FeePaymentSchema.index({schoolId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{deletedAt:null}});
FeePaymentSchema.index({schoolId:1,receiptNo:1},{unique:true,partialFilterExpression:{deletedAt:null}});
FeePaymentSchema.index({schoolId:1,providerOrderId:1},{unique:true,partialFilterExpression:{providerOrderId:{$type:'string'},deletedAt:null}});
FeePaymentSchema.index({schoolId:1,providerPaymentId:1},{unique:true,partialFilterExpression:{providerPaymentId:{$type:'string'},deletedAt:null}});

const FeeRefundSchema=new Schema({
  paymentId:{type:Schema.Types.ObjectId,ref:'FeePayment',required:true,index:true},idempotencyKey:{type:String,required:true},amount:{type:Number,required:true,min:0.01},reason:String,
  status:{type:String,enum:['REQUESTED','PROCESSING','PROCESSED','REJECTED','FAILED'],default:'REQUESTED',index:true},providerRefundId:String,providerStatus:String,lastProviderSyncAt:Date,
  requestedBy:{type:Schema.Types.ObjectId,ref:'User'},processedBy:{type:Schema.Types.ObjectId,ref:'User'},processedAt:Date,failureReason:String,createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
FeeRefundSchema.plugin(tenantPlugin);
FeeRefundSchema.index({schoolId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{deletedAt:null}});
FeeRefundSchema.index({schoolId:1,providerRefundId:1},{unique:true,partialFilterExpression:{providerRefundId:{$type:'string'},deletedAt:null}});

const ProviderWebhookEventSchema=new Schema({
  provider:{type:String,required:true,enum:['RAZORPAY'],index:true},eventId:{type:String,required:true},eventType:{type:String,required:true,index:true},bodyHash:{type:String,required:true},
  providerOrderId:String,providerPaymentId:String,providerRefundId:String,
  status:{type:String,enum:['RECEIVED','PROCESSING','PROCESSED','IGNORED','FAILED'],default:'RECEIVED',index:true},attempts:{type:Number,default:0},failureReason:String,
  receivedAt:{type:Date,default:Date.now},processedAt:Date,updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
ProviderWebhookEventSchema.index({provider:1,eventId:1},{unique:true});
ProviderWebhookEventSchema.index({status:1,receivedAt:1});

export const FeeStructure=model('FeeStructure',FeeStructureSchema);
export const FeeInvoice=model('FeeInvoice',FeeInvoiceSchema);
export const FeePayment=model('FeePayment',FeePaymentSchema);
export const FeeRefund=model('FeeRefund',FeeRefundSchema);
export const ProviderWebhookEvent=model('ProviderWebhookEvent',ProviderWebhookEventSchema);
