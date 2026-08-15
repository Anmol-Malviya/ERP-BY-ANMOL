import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const TemplateSchema=new Schema({
 type:{type:String,required:true,index:true},
 name:{type:String,required:true,trim:true},
 title:{type:String,required:true,trim:true},
 body:{type:String,required:true},
 footer:{type:String,default:''},
 signerName:{type:String,default:''},
 signerDesignation:{type:String,default:''},
 isActive:{type:Boolean,default:true,index:true},
 createdAt:{type:Date,default:Date.now},
 updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
TemplateSchema.plugin(tenantPlugin);

const GeneratedSchema=new Schema({
 type:{type:String,required:true,index:true},
 studentId:{type:Schema.Types.ObjectId,ref:'Student',required:true,index:true},
 templateId:{type:Schema.Types.ObjectId,ref:'DocumentTemplate',required:true,index:true},
 serialNo:{type:String,required:true},
 dataSnapshot:{type:Schema.Types.Mixed,required:true},
 verificationCode:{type:String,required:true,index:true,unique:true},
 status:{type:String,enum:['QUEUED','RENDERING','READY','FAILED','REVOKED'],default:'QUEUED',index:true},
 pdfKey:String,
 pdfName:String,
 pdfBytes:Number,
 pdfChecksum:String,
 failureReason:String,
 generatedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
 createdAt:{type:Date,default:Date.now,index:true},
 generatedAt:Date,
 failedAt:Date,
 revokedAt:Date,
 updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
GeneratedSchema.plugin(tenantPlugin);
GeneratedSchema.index({schoolId:1,serialNo:1},{unique:true,partialFilterExpression:{deletedAt:null}});

export const DocumentTemplate=model('DocumentTemplate',TemplateSchema);
export const GeneratedDocument=model('GeneratedDocument',GeneratedSchema);
