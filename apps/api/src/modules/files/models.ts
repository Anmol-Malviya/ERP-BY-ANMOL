import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';

const FileAssetSchema=new Schema({
 purpose:{type:String,required:true,index:true},
 originalName:{type:String,required:true},
 objectKey:{type:String,required:true},
 contentType:{type:String,required:true},
 declaredSize:{type:Number,required:true,min:1},
 actualSize:{type:Number,min:0},
 etag:String,
 status:{type:String,enum:['INITIATED','UPLOADED','READY','REJECTED','DELETED'],default:'INITIATED',index:true},
 scanStatus:{type:String,enum:['PENDING','CLEAN','INFECTED','ERROR','SKIPPED'],default:'PENDING',index:true},
 scanDetail:String,
 createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 confirmedAt:Date,
 scanCompletedAt:Date,
 createdAt:{type:Date,default:Date.now},
 updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
FileAssetSchema.plugin(tenantPlugin);
FileAssetSchema.index({schoolId:1,objectKey:1},{unique:true,partialFilterExpression:{deletedAt:null}});
export const FileAsset=model('FileAsset',FileAssetSchema);
