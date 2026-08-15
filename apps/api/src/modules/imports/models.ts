import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const ImportJobSchema=new Schema({
 type:{type:String,enum:['students','teachers'],required:true,index:true},
 sourceAssetId:{type:Schema.Types.ObjectId,ref:'FileAsset',required:true,index:true},
 sourceName:{type:String,required:true},
 status:{type:String,enum:['QUEUED','PARSING','IMPORTING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED'],default:'QUEUED',index:true},
 totalRows:{type:Number,default:0,min:0},
 processedRows:{type:Number,default:0,min:0},
 insertedRows:{type:Number,default:0,min:0},
 rejectedRows:{type:Number,default:0,min:0},
 completedBatchIndexes:{type:[Number],default:[],select:false},
 errors:[{row:Number,field:String,message:String}],
 errorCount:{type:Number,default:0,min:0},
 failureReason:String,
 createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 startedAt:Date,
 completedAt:Date,
 createdAt:{type:Date,default:Date.now,index:true},
 updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
ImportJobSchema.plugin(tenantPlugin);
ImportJobSchema.index({schoolId:1,createdAt:-1});

export const ImportJob=model('ImportJob',ImportJobSchema);
