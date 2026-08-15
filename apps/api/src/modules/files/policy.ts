import { DEFAULT_ROLE_PERMISSIONS,PERMISSIONS,type Permission } from '@erp/contracts';
import { AppError,forbidden } from '../../core/errors.js';

const IMAGE=['image/jpeg','image/png','image/webp'];
const DOCUMENT=[...IMAGE,'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const IMPORT=['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export const FILE_POLICIES={
 'student-document':{maxBytes:10*1024*1024,mimeTypes:DOCUMENT,writePermission:PERMISSIONS.STUDENT_WRITE,managerReadPermission:PERMISSIONS.STUDENT_WRITE},
 'assignment-attachment':{maxBytes:15*1024*1024,mimeTypes:DOCUMENT,writePermission:PERMISSIONS.ASSIGNMENT_WRITE,managerReadPermission:PERMISSIONS.ASSIGNMENT_WRITE},
 'assignment-submission':{maxBytes:15*1024*1024,mimeTypes:DOCUMENT,writePermission:PERMISSIONS.ASSIGNMENT_SUBMIT,managerReadPermission:PERMISSIONS.ASSIGNMENT_WRITE},
 'import-source':{maxBytes:20*1024*1024,mimeTypes:IMPORT,writePermission:PERMISSIONS.IMPORT_RUN,managerReadPermission:PERMISSIONS.IMPORT_RUN},
 'knowledge-resource':{maxBytes:20*1024*1024,mimeTypes:DOCUMENT,writePermission:PERMISSIONS.COMMUNICATION_WRITE,managerReadPermission:PERMISSIONS.COMMUNICATION_WRITE},
 'school-branding':{maxBytes:5*1024*1024,mimeTypes:IMAGE,writePermission:PERMISSIONS.SCHOOL_MANAGE,managerReadPermission:PERMISSIONS.SCHOOL_MANAGE},
 'report-template':{maxBytes:10*1024*1024,mimeTypes:[...DOCUMENT],writePermission:PERMISSIONS.REPORT_CARD_WRITE,managerReadPermission:PERMISSIONS.REPORT_CARD_WRITE},
 'document-template':{maxBytes:10*1024*1024,mimeTypes:[...DOCUMENT],writePermission:PERMISSIONS.DOCUMENT_WRITE,managerReadPermission:PERMISSIONS.DOCUMENT_WRITE}
} as const;
export type FilePurpose=keyof typeof FILE_POLICIES;

const EXTENSIONS:Record<string,string[]>={
 'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp'],'application/pdf':['.pdf'],
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'],
 'text/csv':['.csv'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']
};

export function getFilePolicy(purpose:string){const policy=FILE_POLICIES[purpose as FilePurpose];if(!policy)throw new AppError(400,'INVALID_FILE_PURPOSE','Unsupported file purpose');return policy}
export function cleanFileName(value:string){const leaf=String(value||'').split(/[\\/]/).pop()||'file';const normalized=leaf.normalize('NFKC').replace(/[^A-Za-z0-9._ -]/g,'_').replace(/\s+/g,' ').trim().slice(0,120);if(!normalized||normalized==='.'||normalized==='..')throw new AppError(400,'INVALID_FILENAME','Invalid file name');return normalized}
export function validateFileRequest(purpose:string,fileName:string,contentType:string,size:number){const policy=getFilePolicy(purpose),name=cleanFileName(fileName),mime=String(contentType||'').toLowerCase().trim(),bytes=Number(size);if(!(policy.mimeTypes as readonly string[]).includes(mime))throw new AppError(415,'UNSUPPORTED_FILE_TYPE','This file type is not allowed for the selected purpose');if(!Number.isInteger(bytes)||bytes<1||bytes>policy.maxBytes)throw new AppError(413,'FILE_TOO_LARGE',`File must be between 1 byte and ${policy.maxBytes} bytes`);const dot=name.lastIndexOf('.'),ext=dot>=0?name.slice(dot).toLowerCase():'';if(!(EXTENSIONS[mime]||[]).includes(ext))throw new AppError(415,'FILE_EXTENSION_MISMATCH','File extension does not match its content type');return{policy,name,mime,bytes}}
export function effectivePermissions(request:any){const explicit=request.auth?.permissions;if(Array.isArray(explicit))return new Set<Permission>(explicit);const role=request.auth?.role;return new Set<Permission>(role?DEFAULT_ROLE_PERMISSIONS[role]??[]:[])}
export function requirePurposePermission(request:any,purpose:string,mode:'write'|'read'){const policy=getFilePolicy(purpose),permission=(mode==='write'?policy.writePermission:policy.managerReadPermission) as Permission;if(!effectivePermissions(request).has(permission))throw forbidden(`Missing permission: ${permission}`)}
