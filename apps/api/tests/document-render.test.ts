import { describe,expect,it } from 'vitest';
import { formatSchoolAddress,renderTemplateText } from '../src/modules/documents/render.js';

const ctx={
 student:{fullName:'Anmol Malviya',admissionNo:'ADM-1001',rollNo:'27',className:'10',sectionName:'A'},
 school:{name:'ERP Demo School',address:'Indore, Madhya Pradesh, India'},
 issued:{date:'16 August 2026',serialNo:'DOC-2026-ABC123',verificationCode:'VERIFY123'}
};

describe('document template rendering',()=>{
 it('resolves approved dotted placeholders',()=>{
  const output=renderTemplateText('{{student.fullName}} · {{school.name}} · {{issued.serialNo}}',ctx);
  expect(output).toBe('Anmol Malviya · ERP Demo School · DOC-2026-ABC123');
 });
 it('removes unknown placeholders rather than exposing internal paths',()=>{
  expect(renderTemplateText('Hello {{student.unknown}} {{process.env.SECRET}}',ctx)).toBe('Hello  ');
 });
 it('formats structured school addresses without empty separators',()=>{
  expect(formatSchoolAddress({line1:'Vijay Nagar',city:'Indore',state:'Madhya Pradesh',pincode:'452010',country:'India'})).toBe('Vijay Nagar, Indore, Madhya Pradesh, 452010, India');
 });
});
