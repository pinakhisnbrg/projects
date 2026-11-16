import crypto from 'node:crypto';
import QRCode from 'qrcode';

const clean=(x,n=120)=>String(x??'').trim().slice(0,n);
const validToken=x=>typeof x==='string' && /^[a-f0-9]{48,64}$/i.test(x);
const send=(res,status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.status(status).end(JSON.stringify(data));};
const admin=req=>{const secret=process.env.ADMIN_SECRET||'',provided=(req.headers.authorization||'').replace(/^Bearer /,'');if(secret.length<32||!provided)return false;const a=Buffer.from(secret),b=Buffer.from(provided);return a.length===b.length&&crypto.timingSafeEqual(a,b);};
function noAdmin(req,res){if(!admin(req)){send(res,401,{error:'Administrator authorization required'});return true}return false;}
const appURL=()=>String(process.env.APP_BASE_URL||'').replace(/\/$/,'');
async function database(path,method='GET',data=null){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Database not configured');
 const r=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},body:data===null?undefined:JSON.stringify(data),cache:'no-store'});
 const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{j=raw}
 if(!r.ok)throw new Error(j?.message||'Database error '+r.status);return j;
}
async function invite(token){
 const rows=await database('invitations?select=id,household_name,allowed_guests&invite_token=eq.'+encodeURIComponent(token));
 return rows[0]||null;
}
async function state(inv){
 const [rs,ps]=await Promise.all([database('rsvps?select=status,adults,children,guest_names&invitation_id=eq.'+inv.id),database('guest_passes?select=slot,guest_name&active=eq.true&invitation_id=eq.'+inv.id+'&order=slot.asc')]);
 return {household:inv.household_name,limit:inv.allowed_guests,rsvp:rs[0]||null,passes:ps};
}
const defaults={eyebrow:'PRIVATE INVITATION · 27 JANUARY 2027',headline:'An invitation reserved for you.',couple:'Sakshi & Pinak',subtitle:'A celebration worth keeping secret. Until now.',date:'27 January 2027',location:'Chhatrapati Sambhajinagar',footer:'BY INVITATION ONLY · ADMIT WITH LOVE',confirmText:'Confirm my presence',declineText:'Regretfully decline',color:'#781C2A',paper:'#F8ECD7',accent:'#DDBCA9',layout:'minimal',showSeal:true,logoText:'साक्षी  &  पिनाक'};
function sanitizeDesign(d){
 const out={};for(const k of Object.keys(defaults)){const v=d?.[k];if(typeof defaults[k]==='boolean'){out[k]=typeof v==='boolean'?v:defaults[k];continue;}
 if(k==='layout'){out[k]=['minimal','editorial','centered'].includes(v)?v:defaults[k];continue;}
 if(['color','paper','accent'].includes(k)){out[k]=typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:defaults[k];continue;}
 out[k]=clean(v??defaults[k],k==='subtitle'?180:100);}return out;
}
const toJSON=x=>x&&typeof x==='object'?x:{};
async function googleSync(){
 const sid=process.env.GOOGLE_SPREADSHEET_ID,mail=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!sid||!mail||!key)return {status:'not_configured'};
 const [invs,rs,ps]=await Promise.all([database('invitations?select=id,household_name,phone,allowed_guests,invite_token'),database('rsvps?select=*'),database('guest_passes?select=invitation_id,active,checked_in_at')]);
 const map=new Map(rs.map(r=>[r.invitation_id,r]));
 const rows=[['Household','Phone','Invited','Status','Adults','Children','Confirmed','Guest Names','Checked In','Updated At','Invitation URL']];
 for(const i of invs){const r=map.get(i.id),checked=ps.filter(p=>p.invitation_id===i.id&&p.active&&p.checked_in_at).length;rows.push([i.household_name,i.phone||'',i.allowed_guests,r?.status||'pending',r?.adults||0,r?.children||0,r?.status==='yes'?r.adults+r.children:0,(r?.guest_names||[]).join(' | '),checked,r?.updated_at||'',appURL()+'/?invite='+i.invite_token]);}
 const now=Math.floor(Date.now()/1000),b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:mail,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const signed=unsigned+'.'+crypto.sign('RSA-SHA256',Buffer.from(unsigned),key).toString('base64url');
 const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:signed})});
 const auth=await t.json();if(!t.ok)throw Error('Google OAuth authorization failed');
 const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sid)+'/values/Guests!A1:K3000?valueInputOption=RAW',{method:'PUT',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({range:'Guests!A1',majorDimension:'ROWS',values:rows})});
 if(!r.ok)throw Error('Google Sheets synchronization failed');return {status:'synced',households:rows.length-1};
}
export default async function handler(req,res){
 const action=String(req.query.action||'');
 try{
 if(action==='design'&&req.method==='GET'){
   let d=defaults;try{const rows=await database('site_settings?key=eq.homepage&select=value');if(rows.length)d=sanitizeDesign(rows[0].value);}catch(e){if(process.env.SUPABASE_URL)throw e;}
   return send(res,200,{design:d});
 }
 if(action==='design'&&req.method==='POST'){
   if(noAdmin(req,res))return;
   const design=sanitizeDesign(req.body?.design);
   await database('site_settings?on_conflict=key','POST',[{key:'homepage',value:design,updated_at:new Date().toISOString()}]);
   return send(res,200,{design});
 }
 if(action==='invite'&&req.method==='GET'){
   if(!validToken(req.query.invite))return send(res,400,{error:'Invalid invitation link'});
   const inv=await invite(req.query.invite);return inv?send(res,200,await state(inv)):send(res,404,{error:'Invitation not found'});
 }
 if(action==='rsvp'&&req.method==='POST'){
   const b=toJSON(req.body),token=b.invite;
   if(!validToken(token))return send(res,400,{error:'Invalid invitation link'});
   const inv=await invite(token);if(!inv)return send(res,404,{error:'Invitation not found'});
   const status=b.status;if(!['yes','maybe','no'].includes(status))return send(res,400,{error:'Select your attendance'});
   const adults=status==='yes'?Number(b.adults):0,children=status==='yes'?Number(b.children):0;
   const names=Array.isArray(b.names)?b.names.map(n=>clean(n,100)):[];
   if(!Number.isInteger(adults)||!Number.isInteger(children)||adults<0||children<0||adults+children>inv.allowed_guests||(status==='yes'&&(adults<1||names.length!==adults+children||names.some(n=>!n))))return send(res,400,{error:'Check your party size and guest names; maximum '+inv.allowed_guests+' attendees'});
   await database('rpc/submit_wedding_rsvp','POST',{p_token:token,p_status:status,p_adults:adults,p_children:children,p_names:status==='yes'?names:[],p_song:clean(b.song,160)});
   let sheets={status:'pending'};try{sheets=await googleSync()}catch(e){console.error('Google Sheets sync pending',e.message);}
   return send(res,200,{...await state(inv),sheets});
 }
 if(action==='passes'&&req.method==='GET'){
   const token=req.query.invite;if(!validToken(token))return send(res,400,{error:'Invalid invitation'});
   const inv=await invite(token);if(!inv)return send(res,404,{error:'Invitation not found'});
   const r=await database('rsvps?select=status&invitation_id=eq.'+inv.id);
   if(r[0]?.status!=='yes')return send(res,403,{error:'RSVP confirmation required'});
   const ps=await database('guest_passes?select=slot,guest_name&invitation_id=eq.'+inv.id+'&active=eq.true&order=slot.asc');
   return send(res,200,{passes:ps});
 }
 if(action==='qr'&&req.method==='GET'){
   const token=req.query.invite,slot=Number(req.query.slot);
   if(!validToken(token)||!Number.isInteger(slot)||slot<1||slot>30)return send(res,400,{error:'Invalid ticket'});
   const inv=await invite(token);if(!inv)return send(res,404,{error:'Invitation not found'});
   const r=await database('rsvps?select=status&invitation_id=eq.'+inv.id);
   if(r[0]?.status!=='yes')return send(res,403,{error:'RSVP required'});
   const ps=await database('guest_passes?select=checkin_code&invitation_id=eq.'+inv.id+'&slot=eq.'+slot+'&active=eq.true');
   if(!ps.length)return send(res,404,{error:'Ticket not found'});
   const svg=await QRCode.toString('PS-WEDDING:'+ps[0].checkin_code,{type:'svg',margin:2,width:440,color:{dark:'#781C2A',light:'#FFFFFF'}});
   res.setHeader('Content-Type','image/svg+xml');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(200).end(svg);
 }
 if(action==='admin'&&req.method==='GET'){
   if(noAdmin(req,res))return;
   const [invs,rs,ps]=await Promise.all([database('invitations?select=id,household_name,phone,invite_token,allowed_guests&order=household_name.asc'),database('rsvps?select=*'),database('guest_passes?select=invitation_id,active,checked_in_at')]);
   const map=new Map(rs.map(r=>[r.invitation_id,r]));const rows=invs.map(i=>{const r=map.get(i.id);return {household:i.household_name,phone:i.phone||'',invited:i.allowed_guests,status:r?.status||'pending',confirmed:r?.status==='yes'?r.adults+r.children:0,checkedIn:ps.filter(p=>p.invitation_id===i.id&&p.active&&p.checked_in_at).length,url:appURL()+'/?invite='+i.invite_token};});
   return send(res,200,{rows,totals:{target:700,invited:rows.reduce((n,r)=>n+r.invited,0),confirmed:rows.reduce((n,r)=>n+r.confirmed,0),checkedIn:rows.reduce((n,r)=>n+r.checkedIn,0)}});
 }
 if(action==='create-invite'&&req.method==='POST'){
   if(noAdmin(req,res))return;
   const b=toJSON(req.body),name=clean(b.household,100),seats=Number(b.seats),phone=clean(b.phone,30);
   if(!name||!Number.isInteger(seats)||seats<1||seats>30)return send(res,400,{error:'Specify household name and 1–30 seats'});
   const token=crypto.randomBytes(24).toString('hex');
   await database('invitations','POST',{invite_token:token,household_name:name,phone,allowed_guests:seats});
   return send(res,200,{url:appURL()+'/?invite='+token,household:name,seats});
 }
 if(action==='checkin'&&req.method==='POST'){
   if(noAdmin(req,res))return;
   const code=clean(req.body?.code,100).replace(/^PS-WEDDING:/,'');
   if(!validToken(code))return send(res,400,{error:'Invalid QR code'});
   const p=await database('guest_passes?select=id,guest_name,active,checked_in_at&checkin_code=eq.'+code);
   if(!p.length||!p[0].active)return send(res,404,{error:'Ticket not valid'});
   if(p[0].checked_in_at)return send(res,409,{error:'Already checked in',guest:p[0].guest_name});
   const done=await database('guest_passes?id=eq.'+p[0].id+'&checked_in_at=is.null','PATCH',{checked_in_at:new Date().toISOString()});
   return done.length?send(res,200,{ok:true,guest:p[0].guest_name}):send(res,409,{error:'Already checked in'});
 }
 if(action==='sync'&&req.method==='POST'){
   if(noAdmin(req,res))return;return send(res,200,await googleSync());
 }
 return send(res,404,{error:'Unknown API endpoint'});
 }catch(e){console.error(action,e);return send(res,500,{error:'Unable to complete request. Check server configuration or try again.'});}
}
