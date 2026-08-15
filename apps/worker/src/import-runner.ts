import { GetObjectCommand,type S3Client } from '@aws-sdk/client-s3';
import { parseImportFile } from './import-parser.js';

export type ImportJobData={jobId:string;schoolId:string;bucket:string;key:string;contentType:string;type:'students'|'teachers';sourceName:string};
type InternalPost=(path:string,body:unknown)=>Promise<unknown>;
const MAX_SOURCE_BYTES=20*1024*1024,CHUNK_SIZE=200;

async function objectBytes(s3:S3Client,data:ImportJobData){
 const expectedPrefix=`schools/${data.schoolId}/import-source/`;if(!data.key.startsWith(expectedPrefix))throw new Error('Import source is outside the approved school prefix');
 const object=await s3.send(new GetObjectCommand({Bucket:data.bucket,Key:data.key}));if(!object.Body)throw new Error('Import source body unavailable');
 const chunks:Buffer[]=[];let size=0;for await(const raw of object.Body as unknown as AsyncIterable<Uint8Array>){const chunk=Buffer.from(raw);size+=chunk.length;if(size>MAX_SOURCE_BYTES)throw new Error('Import source exceeds 20 MB worker limit');chunks.push(chunk)}return Buffer.concat(chunks,size);
}

export async function processImportFile(s3:S3Client,internalPost:InternalPost,data:ImportJobData){
 if(!data?.jobId||!data?.schoolId||!data?.bucket||!data?.key||!['students','teachers'].includes(data.type))throw new Error('Invalid import job payload');
 try{
  await internalPost('/internal/imports/state',{jobId:data.jobId,schoolId:data.schoolId,status:'PARSING'});
  const bytes=await objectBytes(s3,data);const rows=await parseImportFile(bytes,data.contentType);
  await internalPost('/internal/imports/state',{jobId:data.jobId,schoolId:data.schoolId,status:'IMPORTING',totalRows:rows.length});
  for(let offset=0,batchIndex=0;offset<rows.length;offset+=CHUNK_SIZE,batchIndex++){
   await internalPost('/internal/imports/batch',{jobId:data.jobId,schoolId:data.schoolId,type:data.type,batchIndex,rows:rows.slice(offset,offset+CHUNK_SIZE)});
  }
  await internalPost('/internal/imports/complete',{jobId:data.jobId,schoolId:data.schoolId,totalRows:rows.length});return{rows:rows.length};
 }catch(error){const failureReason=error instanceof Error?error.message:'Unknown import processor error';await internalPost('/internal/imports/state',{jobId:data.jobId,schoolId:data.schoolId,status:'FAILED',failureReason}).catch(()=>undefined);throw error}
}
