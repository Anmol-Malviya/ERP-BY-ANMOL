import { DeleteObjectCommand,GetObjectCommand,HeadObjectCommand,S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

const client=new S3Client({region:env.S3_REGION,endpoint:env.S3_ENDPOINT,forcePathStyle:env.S3_FORCE_PATH_STYLE});
function bucket(){if(!env.S3_BUCKET)throw new AppError(503,'STORAGE_UNAVAILABLE','Private object storage is not configured');return env.S3_BUCKET}
export function buildObjectKey(input:{schoolId:string;purpose:string;assetId:string;fileName:string}){const extension=input.fileName.includes('.')?input.fileName.slice(input.fileName.lastIndexOf('.')).toLowerCase():'';const year=new Date().getUTCFullYear();return `schools/${input.schoolId}/${input.purpose}/${year}/${input.assetId}${extension}`}
export async function createUploadForm(input:{key:string;contentType:string;maxBytes:number;assetId:string;schoolId:string;purpose:string}){return createPresignedPost(client,{Bucket:bucket(),Key:input.key,Expires:300,Fields:{'Content-Type':input.contentType,'x-amz-meta-asset-id':input.assetId,'x-amz-meta-school-id':input.schoolId,'x-amz-meta-purpose':input.purpose},Conditions:[['content-length-range',1,input.maxBytes],['eq','$Content-Type',input.contentType],['eq','$x-amz-meta-asset-id',input.assetId],['eq','$x-amz-meta-school-id',input.schoolId],['eq','$x-amz-meta-purpose',input.purpose]] as any})}
export async function headObject(key:string){return client.send(new HeadObjectCommand({Bucket:bucket(),Key:key}))}
export async function deleteObject(key:string){await client.send(new DeleteObjectCommand({Bucket:bucket(),Key:key}))}
export async function createDownloadUrl(key:string,fileName:string){const safe=fileName.replace(/[^A-Za-z0-9._-]/g,'_');return getSignedUrl(client,new GetObjectCommand({Bucket:bucket(),Key:key,ResponseContentDisposition:`attachment; filename="${safe}"`}),{expiresIn:300})}
export const storageBucket=()=>bucket();
