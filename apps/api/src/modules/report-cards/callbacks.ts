import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError,forbidden } from '../../core/errors.js';
import { runWithTenant } from '../../core/tenant-context.js';
import { env } from '../../config/env.js';
import { ReportCard } from './models.js';

function validSecret(input:string|undefined){const a=Buffer.from(String(input||'')),b=Buffer.from(env.WORKER_CALLBACK_SECRET);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)}
export async function registerReportCardCallbacks(app:FastifyInstance){
 app.post('/api/internal/report-cards/render-result',async(request:any)=>{
  if(!validSecret(request.headers['x-worker-secret'] as string|undefined))throw forbidden('Invalid worker credentials');const{reportCardId,schoolId,key,status,bytes,checksum,detail}=request.body??{};
  if(!Types.ObjectId.isValid(String(reportCardId||''))||!Types.ObjectId.isValid(String(schoolId||''))||!['RENDERING','READY','FAILED'].includes(status))throw new AppError(400,'INVALID_REPORT_RESULT','Invalid report render callback');
  return runWithTenant({schoolId:String(schoolId),requestId:request.id},async()=>{const card:any=await ReportCard.findById(reportCardId);if(!card||card.pdfKey!==key)throw new AppError(404,'NOT_FOUND','Report card not found');if(status==='RENDERING'){card.pdfStatus='RENDERING';card.pdfFailureReason=undefined}else if(status==='READY'){card.pdfStatus='READY';card.pdfBytes=Number(bytes)||undefined;card.pdfChecksum=String(checksum||'').slice(0,128)||undefined;card.pdfGeneratedAt=new Date();card.pdfFailureReason=undefined}else{card.pdfStatus='FAILED';card.pdfFailureReason=String(detail||'Report rendering failed').slice(0,500)}card.updatedAt=new Date();await card.save();return{success:true,data:{id:card._id,status:card.pdfStatus}}});
 });
}
