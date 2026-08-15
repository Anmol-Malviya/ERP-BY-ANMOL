import{Schema,model}from'mongoose';import{tenantPlugin}from'../../core/tenant-plugin.js';
const S=new Schema({
 branding:{primaryColor:{type:String,default:'#274abf'},logoUrl:String,letterheadUrl:String},
 academics:{periodMinutes:{type:Number,default:45},workingDays:[Number],gradingScale:Schema.Types.Mixed},
 attendance:{lateAfter:String,minPercentage:{type:Number,default:75}},
 fees:{currency:{type:String,default:'INR'},lateFeeRules:Schema.Types.Mixed},
 library:{finePerDay:{type:Number,default:2,min:0},studentLoanDays:{type:Number,default:14,min:1,max:365},teacherLoanDays:{type:Number,default:30,min:1,max:365},staffLoanDays:{type:Number,default:30,min:1,max:365}},
 documents:{signatureUrls:[String],certificatePrefix:String},
 locale:{timezone:{type:String,default:'Asia/Kolkata'},dateFormat:{type:String,default:'DD/MM/YYYY'}},
 updatedAt:{type:Date,default:Date.now}
},{versionKey:false});S.plugin(tenantPlugin);S.index({schoolId:1},{unique:true,partialFilterExpression:{deletedAt:null}});
export const SchoolSettings=model('SchoolSettings',S);
