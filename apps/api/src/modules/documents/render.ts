export type DocumentRenderContext={
 student:{fullName:string;admissionNo:string;rollNo?:string;className?:string;sectionName?:string};
 school:{name:string;address:string};
 issued:{date:string;serialNo:string;verificationCode:string};
};

const valueAt=(ctx:DocumentRenderContext,path:string)=>{
 const parts=path.split('.');let current:any=ctx;
 for(const part of parts){if(current==null||typeof current!=='object'||!(part in current))return'';current=current[part]}
 return current==null?'':String(current);
};

export function renderTemplateText(template:string|undefined,ctx:DocumentRenderContext){
 return String(template||'').replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g,(_match,path)=>valueAt(ctx,path));
}

export function formatSchoolAddress(address:any){
 if(!address)return'';
 return [address.line1,address.line2,address.city,address.state,address.pincode,address.country].map(value=>String(value||'').trim()).filter(Boolean).join(', ');
}
