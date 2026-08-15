import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { School } from '../tenancy/models.js';
import { PasswordResetToken,Session,User } from './models.js';
import { runWithTenant } from '../../core/tenant-context.js';
import { hashToken } from '../../core/security.js';
import { enqueueEmail } from '../../core/queue.js';
import { AppError } from '../../core/errors.js';
import { env } from '../../config/env.js';
const genericResponse={success:true,data:{message:'If the account exists, password reset instructions will be sent.'}};
const escapeHtml=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c] as string));
export async function passwordResetRoutes(app:FastifyInstance){
 app.post('/api/auth/forgot-password',{config:{rateLimit:{max:5,timeWindow:'10 minutes'}}},async(request:any)=>{
  const{schoolCode,login}=request.body??{};if(!schoolCode||!login)return genericResponse;
  const school=await School.findOne({code:String(schoolCode).toUpperCase(),status:{$ne:'SUSPENDED'}}).lean();if(!school)return genericResponse;
  await runWithTenant({schoolId:String(school._id),requestId:request.id},async()=>{
   const value=String(login).trim().toLowerCase();const user=await User.findOne({$or:[{email:value},{username:value}],isActive:true}).lean();if(!user?.email)return;
   await PasswordResetToken.updateMany({userId:user._id,usedAt:null},{$set:{usedAt:new Date()}});
   const raw=randomBytes(32).toString('base64url');await PasswordResetToken.create({userId:user._id,tokenHash:hashToken(raw),expiresAt:new Date(Date.now()+30*60_000)});
   const url=new URL(env.PASSWORD_RESET_URL);url.searchParams.set('school',String(school.code));url.searchParams.set('token',raw);const resetUrl=url.toString();
   if(env.NODE_ENV!=='production')request.log.info({resetUrl,userId:String(user._id)},'development password reset link');
   const name=escapeHtml(String(user.firstName||'User'));
   await enqueueEmail({to:user.email,subject:'Reset your ERP BY ANMOL password',text:`Hello ${user.firstName||'User'}, reset your password using this link: ${resetUrl}. This link expires in 30 minutes.`,html:`<p>Hello ${name},</p><p>We received a request to reset your ERP BY ANMOL password.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,tags:{kind:'password-reset',schoolId:String(school._id)}}).catch(error=>request.log.error({err:error},'failed to enqueue password reset email'));
  });return genericResponse;
 });
 app.post('/api/auth/reset-password',{config:{rateLimit:{max:8,timeWindow:'10 minutes'}}},async(request:any)=>{
  const{schoolCode,token,newPassword}=request.body??{};if(!schoolCode||!token||!newPassword)throw new AppError(400,'INVALID_INPUT','schoolCode, token and newPassword are required');if(String(newPassword).length<8)throw new AppError(400,'WEAK_PASSWORD','Password must be at least 8 characters');
  const school=await School.findOne({code:String(schoolCode).toUpperCase(),status:{$ne:'SUSPENDED'}}).lean();if(!school)throw new AppError(400,'INVALID_RESET','Reset link is invalid or expired');
  return runWithTenant({schoolId:String(school._id),requestId:request.id},async()=>{
   const reset=await PasswordResetToken.findOne({tokenHash:hashToken(String(token)),usedAt:null,expiresAt:{$gt:new Date()}}).select('+tokenHash');if(!reset)throw new AppError(400,'INVALID_RESET','Reset link is invalid or expired');
   const user=await User.findById(reset.userId).select('+passwordHash');if(!user?.isActive)throw new AppError(400,'INVALID_RESET','Reset link is invalid or expired');
   user.passwordHash=await bcrypt.hash(String(newPassword),12);user.mustChangePassword=false;user.updatedAt=new Date();await user.save();reset.usedAt=new Date();await reset.save();await Session.updateMany({userId:user._id,revokedAt:null},{$set:{revokedAt:new Date()}});
   return{success:true,data:{message:'Password updated. Sign in with your new password.'}};
  });
 });
}
