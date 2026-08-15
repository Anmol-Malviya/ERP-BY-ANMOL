import { describe,expect,it,vi } from 'vitest';
import { renderReportCard } from '../src/report-runner.js';

describe('report card renderer',()=>{
 it('uploads a PDF and reports READY with checksum metadata',async()=>{
  const send=vi.fn(async(command:any)=>{expect(command.input.Bucket).toBe('private-erp');expect(command.input.Key).toBe('schools/school-1/report-cards/exam-1/card-1.pdf');expect(command.input.ContentType).toBe('application/pdf');expect(Buffer.from(command.input.Body).subarray(0,4).toString()).toBe('%PDF');return{}});
  const callbacks:any[]=[];const internalPost=vi.fn(async(path:string,body:any)=>{callbacks.push({path,body});return{success:true}});
  const result=await renderReportCard({send} as any,internalPost,{
   reportCardId:'card-1',schoolId:'school-1',bucket:'private-erp',key:'schools/school-1/report-cards/exam-1/card-1.pdf',fileName:'report.pdf',
   render:{schoolName:'Demo School',schoolAddress:'Indore, India',studentName:'Anmol Malviya',admissionNo:'ADM-1',rollNo:'27',className:'10',sectionName:'A',examName:'Term 1',term:'First Term',subjects:[{name:'Mathematics',maxMarks:100,obtained:91,grade:'A+'},{name:'Science',maxMarks:100,obtained:87,grade:'A'}],obtained:178,maximum:200,percentage:89,grade:'A',result:'PASS',attendancePercentage:94.5,attendancePresent:189,attendanceTotal:200,published:true}
  });
  expect(send).toHaveBeenCalledTimes(1);expect(result.bytes).toBeGreaterThan(500);expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);expect(callbacks[0]).toMatchObject({path:'/internal/report-cards/render-result',body:{status:'RENDERING'}});expect(callbacks.at(-1)).toMatchObject({path:'/internal/report-cards/render-result',body:{status:'READY',checksum:result.checksum}});
 });
});
