import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const LeaveSchema=new Schema({
 applicantType:{type:String,enum:['STUDENT','TEACHER','STAFF'],required:true,index:true},
 applicantId:{type:Schema.Types.ObjectId,required:true,index:true},
 fromDate:{type:Date,required:true,index:true},toDate:{type:Date,required:true,index:true},
 reason:{type:String,required:true,trim:true,maxlength:1000},
 status:{type:String,enum:['PENDING','APPROVED','REJECTED','CANCELLED'],default:'PENDING',index:true},
 approverId:{type:Schema.Types.ObjectId,ref:'User'},decisionNote:{type:String,maxlength:1000},decidedAt:Date,
 createdAt:{type:Date,default:Date.now,index:true},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
LeaveSchema.plugin(tenantPlugin);
LeaveSchema.index({schoolId:1,applicantType:1,applicantId:1,fromDate:-1});
LeaveSchema.index({schoolId:1,status:1,fromDate:1});
export const LeaveRequest=model('LeaveRequest',LeaveSchema);
