import * as ExcelJS from 'exceljs';
import { describe,expect,it } from 'vitest';
import { parseImportFile } from '../src/import-parser.js';

describe('import parser',()=>{
 it('parses quoted CSV fields and canonicalizes common headers',async()=>{
  const csv='First Name,Admission No,Class,Section,Email\r\n"Anmol, Test",ADM-1,10,A,test@example.com\r\n';
  const rows=await parseImportFile(Buffer.from(csv),'text/csv');
  expect(rows).toEqual([{row:2,data:{firstName:'Anmol, Test',admissionNo:'ADM-1',className:'10',sectionName:'A',email:'test@example.com'}}]);
 });
 it('rejects malformed quoted CSV rather than guessing content',async()=>{
  await expect(parseImportFile(Buffer.from('First Name,Admission No\n"Broken,ADM-1'),'text/csv')).rejects.toThrow(/unterminated/i);
 });
 it('reads the first XLSX worksheet without evaluating formulas',async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Students');sheet.addRow(['First Name','Admission No','Roll No']);sheet.addRow(['Aarav','ADM-2','12']);const bytes=await workbook.xlsx.writeBuffer();
  const rows=await parseImportFile(Buffer.from(bytes),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(rows[0]).toEqual({row:2,data:{firstName:'Aarav',admissionNo:'ADM-2',rollNo:'12'}});
 });
});
