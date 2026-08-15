import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const TemplateSchema=new Schema({name:{type:String,required:true},description:String,version:{type:Number,default:1},layout:Schema.Types.Mixed,isDefault:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}},{versionKey:false});TemplateSchema.plugin(tenantPlugin);
const ReportSchema=new Schema({
 studentId:{type:Schema.Types.ObjectId,ref:'Student',required:true,index:true},examId:{type:Schema.Types.ObjectId,ref:'Exam',required:true,index:true},templateId:{type:Schema.Types.ObjectId,ref:'ReportTemplate'},
 snapshot:{type:Schema.Types.Mixed,required:true},result:{type:String,enum:['PASS','FAIL','PROMOTED','WITHHELD']},percentage:Number,grade:String,publishedAt:Date,
 pdfStatus:{type:String,enum:['QUEUED','RENDERING','READY','FAILED'],default:'QUEUED',index:true},pdfKey:String,pdfName:String,pdfBytes:Number,pdfChecksum:String,pdfFailureReason:String,pdfGeneratedAt:Date,
 createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});ReportSchema.plugin(tenantPlugin);ReportSchema.index({schoolId:1,studentId:1,examId:1},{unique:true,partialFilterExpression:{deletedAt:null}});
export const ReportTemplate=model('ReportTemplate',TemplateSchema);export const ReportCard=model('ReportCard',ReportSchema);
