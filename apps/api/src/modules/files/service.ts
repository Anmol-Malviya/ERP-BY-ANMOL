import { AppError } from '../../core/errors.js';
import { FileAsset } from './models.js';
import type { FilePurpose } from './policy.js';
import { cleanFileName } from './policy.js';
import { createDownloadUrl } from './storage.js';

export async function issueDomainAssetDownload(assetId:any,purpose:FilePurpose){const asset:any=await FileAsset.findOne({_id:assetId,purpose,status:'READY',scanStatus:{$in:['CLEAN','SKIPPED']}}).lean();if(!asset)throw new AppError(404,'FILE_NOT_FOUND','Cleared file asset not found');return{asset,url:await createDownloadUrl(asset.objectKey,cleanFileName(asset.originalName)),expiresIn:300}}
