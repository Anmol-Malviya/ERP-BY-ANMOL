import { afterAll,afterEach,beforeAll,describe,expect,it } from 'vitest';
import { connectDb,disconnectDb } from '../src/core/db.js';
import { runWithTenant } from '../src/core/tenant-context.js';
import { School } from '../src/modules/tenancy/models.js';
import { Student } from '../src/modules/people/models.js';

async function seed(){const[a,b]=await School.create([{name:'School A',code:`A${Date.now()}`,status:'ACTIVE'},{name:'School B',code:`B${Date.now()}`,status:'ACTIVE'}]);const studentA=await runWithTenant({schoolId:String(a._id)},()=>Student.create({firstName:'Asha',lastName:'A',admissionNo:'A-001'}));const studentB=await runWithTenant({schoolId:String(b._id)},()=>Student.create({firstName:'Bharat',lastName:'B',admissionNo:'B-001'}));return{a,b,studentA,studentB}}

beforeAll(async()=>{await connectDb()});
afterEach(async()=>{await runWithTenant({isPlatform:true},()=>Student.deleteMany({}));await School.deleteMany({})});
afterAll(async()=>{await disconnectDb()});

describe('central tenant isolation',()=>{
 it('limits normal reads and direct id lookup to the active school',async()=>{const{a,studentB}=await seed();const list=await runWithTenant({schoolId:String(a._id)},()=>Student.find().lean());expect(list).toHaveLength(1);expect(list[0].firstName).toBe('Asha');const foreign=await runWithTenant({schoolId:String(a._id)},()=>Student.findById(studentB._id).lean());expect(foreign).toBeNull()});
 it('prevents cross-tenant updates even when the attacker knows the foreign id',async()=>{const{a,b,studentB}=await seed();const updated=await runWithTenant({schoolId:String(a._id)},()=>Student.findByIdAndUpdate(studentB._id,{$set:{firstName:'Hijacked'}},{new:true}).lean());expect(updated).toBeNull();const actual=await runWithTenant({schoolId:String(b._id)},()=>Student.findById(studentB._id).lean());expect(actual?.firstName).toBe('Bharat')});
 it('rejects writes that explicitly try to inject another school id',async()=>{const{a,b}=await seed();await expect(runWithTenant({schoolId:String(a._id)},()=>Student.create({schoolId:b._id,firstName:'Mallory',admissionNo:'X-001'}))).rejects.toThrow(/Cross-tenant write rejected/)});
 it('scopes aggregation pipelines and allows explicit platform visibility',async()=>{const{a}=await seed();const tenantCount=await runWithTenant({schoolId:String(a._id)},()=>Student.aggregate([{$count:'count'}]));expect(tenantCount[0]?.count).toBe(1);const platformRows=await runWithTenant({isPlatform:true},()=>Student.find().sort({firstName:1}).lean());expect(platformRows.map(x=>x.firstName)).toEqual(['Asha','Bharat'])});
});
