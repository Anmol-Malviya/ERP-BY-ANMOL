import { Schema,model } from 'mongoose';
import { tenantPlugin } from '../../core/tenant-plugin.js';
const UserSchema=new Schema({
 email:{type:String,trim:true,lowercase:true},username:{type:String,trim:true,lowercase:true},
 passwordHash:{type:String,required:true,select:false},firstName:{type:String,required:true,trim:true,maxlength:100},lastName:{type:String,default:'',trim:true,maxlength:100},
 role:{type:String,required:true,index:true},permissions:[{type:String}],profileType:{type:String,enum:['STUDENT','TEACHER','STAFF','GUARDIAN'],index:true},profileId:{type:Schema.Types.ObjectId,index:true},oasesRoles:[{type:String,enum:['SCAN_OPERATOR','EVALUATOR','HEAD_EXAMINER']}],isActive:{type:Boolean,default:true,index:true},
 mustChangePassword:{type:Boolean,default:false},lastLoginAt:Date,createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
UserSchema.plugin(tenantPlugin);
UserSchema.index({schoolId:1,email:1},{unique:true,partialFilterExpression:{email:{$type:'string'},deletedAt:null}});
UserSchema.index({schoolId:1,username:1},{unique:true,partialFilterExpression:{username:{$type:'string'},deletedAt:null}});
UserSchema.index({schoolId:1,profileType:1,profileId:1},{unique:true,partialFilterExpression:{profileType:{$type:'string'},profileId:{$type:'objectId'},deletedAt:null}});
const SessionSchema=new Schema({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},refreshTokenHash:{type:String,required:true,unique:true},userAgent:{type:String,maxlength:500},ip:{type:String,maxlength:100},expiresAt:{type:Date,required:true,index:true},revokedAt:Date,createdAt:{type:Date,default:Date.now}},{versionKey:false});
SessionSchema.plugin(tenantPlugin);
const PasswordResetTokenSchema=new Schema({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},tokenHash:{type:String,required:true,unique:true,select:false},expiresAt:{type:Date,required:true,index:true},usedAt:Date,createdAt:{type:Date,default:Date.now}},{versionKey:false});
PasswordResetTokenSchema.plugin(tenantPlugin);PasswordResetTokenSchema.index({expiresAt:1},{expireAfterSeconds:0});
export const User=model('User',UserSchema);export const Session=model('Session',SessionSchema);export const PasswordResetToken=model('PasswordResetToken',PasswordResetTokenSchema);
