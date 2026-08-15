import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{ArrowLeft,Building2,ChartNoAxesCombined,CheckCircle2,Copy,KeyRound,Layers3,LogOut,Plus,Power,Save,Search,ShieldCheck,X}from'lucide-react';
import{MODULES}from'@erp/contracts';
import'./styles.css';

const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api';
let token=sessionStorage.getItem('platform_token')||'';

type School={_id:string;name:string;code:string;plan:string;status:string;enabledModules:string[]};
type ApiEnvelope<T>={success:boolean;data:T};

async function call<T=any>(path:string,options:RequestInit={}):Promise<ApiEnvelope<T>>{
  const response=await fetch(`${API}${path}`,{
    ...options,
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}
  });
  const body=await response.json() as any;
  if(!response.ok)throw new Error(body?.error?.message||'Request failed');
  return body as ApiEnvelope<T>;
}

function App(){
  const[authed,setAuthed]=useState(Boolean(token));
  const[view,setView]=useState('Overview');
  const[schools,setSchools]=useState<School[]>([]);
  const[metrics,setMetrics]=useState<any>(null);
  const[error,setError]=useState('');
  const[creating,setCreating]=useState(false);
  const[selected,setSelected]=useState<School|null>(null);

  const load=async()=>{
    setError('');
    try{
      const[s,m]=await Promise.all([call<School[]>('/platform/schools'),call('/platform/metrics')]);
      setSchools(s.data);setMetrics(m.data);
    }catch(error:unknown){setError(error instanceof Error?error.message:'Unable to load platform data')}
  };
  useEffect(()=>{if(authed)void load()},[authed]);
  if(!authed)return<Login onDone={()=>setAuthed(true)}/>;

  const links=[
    {label:'Overview',icon:ChartNoAxesCombined},
    {label:'Schools',icon:Building2},
    {label:'Modules & plans',icon:Layers3},
    {label:'Security & audit',icon:ShieldCheck}
  ];
  return <div className="sa-shell">
    <aside>
      <div className="sa-brand"><span>A</span><div><b>ERP BY ANMOL</b><small>Platform Control</small></div></div>
      <nav>{links.map(({label,icon:Icon})=><button key={label} className={view===label?'active':''} onClick={()=>setView(label)}><Icon size={17}/>{label}</button>)}</nav>
      <button className="logout" onClick={()=>{sessionStorage.clear();location.reload()}}><LogOut size={16}/>Sign out</button>
    </aside>
    <main>
      <header><div><small>PLATFORM ADMINISTRATION</small><h1>{view}</h1></div><button className="new" onClick={()=>setCreating(true)}><Plus size={16}/>Add school</button></header>
      {error&&<div className="error">{error}</div>}
      {view==='Overview'&&<><div className="metrics"><Metric label="Total schools" value={metrics?.schools?.total??schools.length}/><Metric label="Active" value={metrics?.schools?.active??'—'}/><Metric label="Trial" value={metrics?.schools?.trial??'—'}/><Metric label="MFA admins" value={metrics?.security?.mfaEnabledAdmins??'—'}/></div><Schools schools={schools} onManage={setSelected}/></>}
      {view==='Schools'&&<Schools schools={schools} onManage={setSelected}/>} 
      {view==='Modules & plans'&&<section className="surface"><div className="surface-head"><div><small>ENTITLEMENTS</small><h2>School module controls</h2></div></div><p className="muted-copy">Open any school from the directory to manage plan, status and module access. Backend entitlement checks enforce the selection on every protected module request.</p></section>}
      {view==='Security & audit'&&<SecurityPanel/>}
    </main>
    {creating&&<CreateSchool onClose={()=>setCreating(false)} onCreated={async()=>{setCreating(false);await load()}}/>}
    {selected&&<SchoolManager school={selected} onClose={()=>setSelected(null)} onSaved={async()=>{setSelected(null);await load()}}/>}
  </div>;
}

function Metric({label,value}:{label:string;value:React.ReactNode}){return <div className="metric"><span>{label}</span><b>{value}</b><small>Platform wide</small></div>}

function Schools({schools,onManage}:{schools:School[];onManage:(school:School)=>void}){
  const[q,setQ]=useState('');
  const visible=useMemo(()=>schools.filter(s=>`${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase())),[schools,q]);
  return <section className="surface"><div className="surface-head"><div><small>TENANT DIRECTORY</small><h2>Schools</h2></div><label><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search schools"/></label></div><div className="school-list">{visible.length?visible.map(s=><div className="school-row" key={s._id}><div className="school-logo">{s.name?.[0]}</div><div><b>{s.name}</b><small>{s.code} · {s.plan} · {(s.enabledModules||[]).length} modules</small></div><span className={`status ${s.status?.toLowerCase()}`}>{s.status}</span><button onClick={()=>onManage(s)}>Manage</button></div>):<div className="empty">No matching schools.</div>}</div></section>;
}

function SecurityPanel(){
  const[setup,setSetup]=useState<{manualKey:string}|null>(null),[code,setCode]=useState(''),[recovery,setRecovery]=useState<string[]>([]),[password,setPassword]=useState(''),[disableCode,setDisableCode]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const start=async()=>{setError('');setMessage('');try{const r=await call<{manualKey:string}>('/platform/auth/mfa/setup',{method:'POST'});setSetup(r.data)}catch(error:unknown){setError(error instanceof Error?error.message:'MFA setup failed')}};
  const enable=async()=>{setError('');try{const r=await call<{recoveryCodes:string[]}>('/platform/auth/mfa/enable',{method:'POST',body:JSON.stringify({code})});setRecovery(r.data.recoveryCodes||[]);setSetup(null);setCode('');setMessage('Authenticator MFA is now enabled. The next platform login will require verification.')}catch(error:unknown){setError(error instanceof Error?error.message:'MFA verification failed')}};
  const disable=async()=>{setError('');try{await call('/platform/auth/mfa/disable',{method:'POST',body:JSON.stringify({password,code:disableCode})});setPassword('');setDisableCode('');setRecovery([]);setMessage('MFA disabled. Re-enable it before public production launch.')}catch(error:unknown){setError(error instanceof Error?error.message:'Unable to disable MFA')}};
  return <section className="surface security-panel">
    <div className="surface-head"><div><small>PRIVILEGED ACCESS</small><h2>Authenticator MFA</h2></div></div>
    <p className="muted-copy">Platform administrators use a separate trust boundary. Secrets are encrypted at rest and recovery codes are stored only as hashes.</p>
    {error&&<div className="error">{error}</div>}{message&&<div className="success-note"><CheckCircle2 size={15}/>{message}</div>}
    {!setup&&!recovery.length&&<button className="new inline" onClick={start}><KeyRound size={15}/>Set up authenticator MFA</button>}
    {setup&&<div className="mfa-setup"><div><small>MANUAL KEY</small><code>{setup.manualKey}</code><button className="copy" onClick={()=>void navigator.clipboard?.writeText(setup.manualKey)}><Copy size={13}/>Copy</button></div><p>Add this key to your authenticator app, then enter its current 6-digit code.</p><label>Verification code<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button className="new inline" onClick={enable} disabled={code.length!==6}>Enable MFA</button></div>}
    {recovery.length>0&&<div className="recovery-box"><b>Save these recovery codes now</b><p>Each code works once. They are not shown again.</p><div>{recovery.map(item=><code key={item}>{item}</code>)}</div></div>}
    <div className="danger-zone"><b>Disable MFA</b><p>Requires both your current platform password and authenticator code.</p><div className="danger-fields"><input type="password" placeholder="Current password" value={password} onChange={e=>setPassword(e.target.value)}/><input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={disableCode} onChange={e=>setDisableCode(e.target.value.replace(/\D/g,''))}/><button className="cancel" onClick={disable}>Disable</button></div></div>
  </section>;
}

function CreateSchool({onClose,onCreated}:{onClose:()=>void;onCreated:()=>void}){
  const[form,setForm]=useState({name:'',code:'',email:'',phone:'',plan:'STARTER',adminEmail:'',adminPassword:'',adminFirstName:'School',adminLastName:'Admin'}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{await call('/platform/schools',{method:'POST',body:JSON.stringify({name:form.name,code:form.code,email:form.email,phone:form.phone,plan:form.plan,admin:{email:form.adminEmail,password:form.adminPassword,firstName:form.adminFirstName,lastName:form.adminLastName}})});onCreated()}catch(error:unknown){setError(error instanceof Error?error.message:'Unable to create school')}finally{setBusy(false)}};
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="modal-head"><div><small>NEW TENANT</small><h2>Onboard school</h2></div><button type="button" className="plain" onClick={onClose}><X/></button></div><div className="form-grid"><Field label="School name" value={form.name} onChange={v=>set('name',v)}/><Field label="School code" value={form.code} onChange={v=>set('code',v.toUpperCase())}/><Field label="School email" value={form.email} onChange={v=>set('email',v)}/><Field label="Phone" value={form.phone} onChange={v=>set('phone',v)}/><label>Plan<select value={form.plan} onChange={e=>set('plan',e.target.value)}><option>STARTER</option><option>GROWTH</option><option>PRO</option></select></label><span/><Field label="First admin email" value={form.adminEmail} onChange={v=>set('adminEmail',v)}/><Field label="Temporary password" type="password" value={form.adminPassword} onChange={v=>set('adminPassword',v)}/><Field label="Admin first name" value={form.adminFirstName} onChange={v=>set('adminFirstName',v)}/><Field label="Admin last name" value={form.adminLastName} onChange={v=>set('adminLastName',v)}/></div>{error&&<div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="new" disabled={busy}><Plus size={15}/>{busy?'Creating…':'Create school'}</button></div></form></div>;
}

function SchoolManager({school,onClose,onSaved}:{school:School;onClose:()=>void;onSaved:()=>void}){
  const[status,setStatus]=useState(school.status),[plan,setPlan]=useState(school.plan),[enabled,setEnabled]=useState<string[]>(school.enabledModules||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const toggle=(module:string)=>setEnabled(current=>current.includes(module)?current.filter(value=>value!==module):[...current,module]);
  const save=async()=>{setBusy(true);setError('');try{await call(`/platform/schools/${school._id}`,{method:'PATCH',body:JSON.stringify({status,plan,enabledModules:enabled})});onSaved()}catch(error:unknown){setError(error instanceof Error?error.message:'Unable to save school controls')}finally{setBusy(false)}};
  return <div className="modal-backdrop"><section className="modal-card wide"><div className="modal-head"><div><small>TENANT CONTROL</small><h2>{school.name}</h2><p>{school.code}</p></div><button className="plain" onClick={onClose}><X/></button></div><div className="tenant-controls"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option>ACTIVE</option><option>TRIAL</option><option>SUSPENDED</option></select></label><label>Plan<select value={plan} onChange={e=>setPlan(e.target.value)}><option>STARTER</option><option>GROWTH</option><option>PRO</option></select></label></div><div className="module-grid">{MODULES.filter(m=>m!=='dashboard').map(m=><label className="module-toggle" key={m}><input type="checkbox" checked={enabled.includes(m)} onChange={()=>toggle(m)}/><span><b>{m.replaceAll('-',' ')}</b><small>{enabled.includes(m)?'Enabled':'Disabled'}</small></span></label>)}</div>{error&&<div className="error">{error}</div>}<div className="modal-actions"><button className="cancel" onClick={()=>setStatus(status==='SUSPENDED'?'ACTIVE':'SUSPENDED')}><Power size={14}/>{status==='SUSPENDED'?'Reactivate':'Suspend'}</button><button className="new" onClick={save} disabled={busy}><Save size={15}/>{busy?'Saving…':'Save controls'}</button></div></section></div>;
}

function Field({label,value,onChange,type='text'}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <label>{label}<input required={label.includes('name')||label.includes('code')||label.includes('admin')||label.includes('password')} type={type} value={value} onChange={e=>onChange(e.target.value)}/></label>}

function Login({onDone}:{onDone:()=>void}){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const credentials=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{const response=await call<any>('/platform/auth/login',{method:'POST',body:JSON.stringify({email,password})});if(response.data.mfaRequired){setChallenge(response.data.challengeToken);setPassword('');return}token=response.data.accessToken;sessionStorage.setItem('platform_token',token);onDone()}catch(error:unknown){setError(error instanceof Error?error.message:'Sign in failed')}finally{setBusy(false)}};
  const verify=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{const response=await call<any>('/platform/auth/mfa/verify',{method:'POST',body:JSON.stringify({challengeToken:challenge,code})});token=response.data.accessToken;sessionStorage.setItem('platform_token',token);onDone()}catch(error:unknown){setError(error instanceof Error?error.message:'Verification failed')}finally{setBusy(false)}};
  return <div className="sa-login"><form onSubmit={challenge?verify:credentials}><div className="sa-lock">A</div><small>ERP BY ANMOL · PLATFORM</small><h1>{challenge?'Verify your identity':'Platform administration'}</h1><p>{challenge?'Enter the current authenticator code or a one-time recovery code.':'Separate privileged access for managing schools, plans and platform controls.'}</p>{challenge?<><label>Verification or recovery code<input autoFocus value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code"/></label><button type="button" className="back-login" onClick={()=>{setChallenge('');setCode('');setError('')}}><ArrowLeft size={14}/>Use password again</button></>:<><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label></>}{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?'Verifying…':challenge?'Verify & continue':'Sign in securely'}</button></form></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
