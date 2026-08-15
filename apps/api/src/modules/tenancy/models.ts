import { Schema,model } from 'mongoose';
const SchoolSchema=new Schema({
 name:{type:String,required:true,trim:true},code:{type:String,required:true,uppercase:true,trim:true,unique:true,index:true},
 email:{type:String,lowercase:true},phone:String,address:{line1:String,line2:String,city:String,state:String,pincode:String,country:{type:String,default:'India'}},
 logoUrl:String,status:{type:String,enum:['ACTIVE','SUSPENDED','TRIAL'],default:'TRIAL',index:true},plan:{type:String,enum:['STARTER','GROWTH','PRO'],default:'STARTER'},
 enabledModules:[{type:String}],academicYearLabel:String,timezone:{type:String,default:'Asia/Kolkata'},createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
const PlatformAdminSchema=new Schema({email:{type:String,required:true,lowercase:true,unique:true},passwordHash:{type:String,required:true,select:false},name:{type:String,required:true},isActive:{type:Boolean,default:true},mfaEnabled:{type:Boolean,default:false},lastLoginAt:Date,createdAt:{type:Date,default:Date.now}},{versionKey:false});
export const School=model('School',SchoolSchema);export const PlatformAdmin=model('PlatformAdmin',PlatformAdminSchema);
