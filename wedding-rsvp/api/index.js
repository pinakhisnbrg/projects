import crypto from 'node:crypto';
import QRCode from 'qrcode';
const tokenOK=v=>typeof v==='string'&&/^[a-f0-9]{48,64}$/i.test(v);
const respond=(res,code,data)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.status(code).end(JSON.stringify(data))};
const admin=req=>{const a=process.env.ADMIN_SECRET||'',b=(req.headers.authorization||'').replace(/^Bearer /,'');return a.length>=32&&b.length===a.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b))};
const defaults={eyebrow:'PRIVATE INVITATION · 27 JANUARY 2027',headline:'An invitation reserved for you.',couple:'Sakshi & Pinak',subtitle:'A celebration worth keeping secret. Until now.',date:'27 January 2027',location:'Chhatrapati Sambhajinagar',footer:'BY INVITATION ONLY · ADMIT WITH LOVE',confirmText:'Confirm my presence',declineText:'Regretfully decline',color:'#781C2A',paper:'#F8ECD7',accent:'#DDBCA9',layout:'minimal'};
function sanitizeDesign(d){const out={};for(const [k,v] of Object.entries(defaults)){let val=d?.[k];if(['paper','color','accent'].includes(k))out[k]=typeof val==='string'&&/^#[0-9a-f]{6}$/i.test(val)?val:v;else if(k==='layout')out[k]=['minimal','centered','editorial'].includes(val)?val:v;else out[k]=String(val??v).slice(0,150)}return out}
async function sheet(action,data={}){
 const url=process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL,secret=process.env.RSVP_WEBHOOK_SECRET;
 if(!/^https:\/\/script\.google\.com\/macros\/s\//.test(url||'')||!secret||secret.length<32)throw Error('Sheets integration not configured');
 const req=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...data,secret}),redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!req.ok)throw Error('Google Apps Script returned '+req.status);
 const body=await req.json();
 if(!body.ok)throw Error(body.error||'Sheets operation failed');
 return body.result;
}
async function qr(res,text){
 const png=await QRCode.toBuffer(text,{type:'png',width:550,margin:3,errorCorrectionLevel:'H',color:{dark:'#781C2A',light:'#FFFFFF'}});
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.status(200).end(png);
}
async function cloudSend({phone,name,url}){
 const token=process.env.META_WHATSAPP_ACCESS_TOKEN,id=process.env.META_WHATSAPP_PHONE_NUMBER_ID,template=process.env.META_WHATSAPP_TEMPLATE_NAME,language=process.env.META_WHATSAPP_TEMPLATE_LANGUAGE||'en';
 if(!token||!id||!template)throw Error('WhatsApp Cloud API credentials and approved template not configured');
 // Template must have exactly 2 BODY placeholders: {{1}} recipient name, {{2}} invitation URL.
 const body={messaging_product:'whatsapp',to:phone.replace(/^\+/,''),type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:name.slice(0,100)},{type:'text',text:url}]}]}};
 const response=await fetch('https://graph.facebook.com/v23.0/'+encodeURIComponent(id)+'/messages',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const j=await response.json();if(!response.ok||!j.messages?.[0]?.id)throw Error('WhatsApp provider rejected template message');
 return j.messages[0].id;
}
export default async function handler(req,res){
 const action=String(req.query.action||'');
 try{
  if(action==='design'&&req.method==='GET'){let config=defaults;if(process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL&&process.env.RSVP_WEBHOOK_SECRET){const d=await sheet('design_read');config=sanitizeDesign(d||defaults)}return respond(res,200,{design:config})}
  if(action==='design'&&req.method==='POST'){if(!admin(req))return respond(res,401,{error:'Admin authorization required'});const design=sanitizeDesign(req.body?.design);await sheet('design_write',{design});return respond(res,200,{design})}
  if(action==='demo-qr'&&req.method==='GET')return await qr(res,'DEMO-ONLY-NOT-VALID-FOR-ENTRY');
  if(action==='invite'&&req.method==='GET'){
   if(!tokenOK(req.query.invite))return respond(res,400,{error:'Invalid invitation link'});
   const d=await sheet('lookup',{token:req.query.invite});
   return respond(res,200,{household:d.guest.name,limit:d.guest.max,rsvp:d.guest.rsvp==='Pending'?null:{status:d.guest.rsvp==='Yes'?'yes':'no',count:d.guest.count},passes:d.passes});
  }
  if(action==='rsvp'&&req.method==='POST'){
   const token=req.body?.invite,status=req.body?.status,count=Number(req.body?.count);
   if(!tokenOK(token)||!['yes','no'].includes(status)||!Number.isInteger(count)||count<0||count>30||(status==='yes'&&count<1))return respond(res,400,{error:'Invalid RSVP or guest count'});
   const d=await sheet('rsvp',{token,rsvp:status==='yes'?'Yes':'No',count:status==='yes'?count:0});
   return respond(res,200,{household:d.guest.name,limit:d.guest.max,rsvp:{status,count:d.guest.count},passes:d.passes});
  }
  if(action==='passes'&&req.method==='GET'){
   if(!tokenOK(req.query.invite))return respond(res,400,{error:'Invalid invitation'});
   const d=await sheet('lookup',{token:req.query.invite});
   if(d.guest.rsvp!=='Yes')return respond(res,403,{error:'Please confirm your attendance first'});
   return respond(res,200,{passes:d.passes.map(p=>({slot:p.slot,guest_name:d.guest.name,checked_in:p.checked}))});
  }
  if(action==='qr'&&req.method==='GET'){
   if(!tokenOK(req.query.invite)||!Number.isInteger(Number(req.query.slot)))return respond(res,400,{error:'Invalid QR request'});
   const d=await sheet('qr',{token:req.query.invite,slot:Number(req.query.slot)});
   return await qr(res,'PS-WEDDING:'+d.code);
  }
  if(action==='admin'&&req.method==='GET'){
   if(!admin(req))return respond(res,401,{error:'Admin authorization required'});
   const d=await sheet('list');
   return respond(res,200,{rows:d.guests.map(g=>({row:g.row,household:g.name,phone:g.phone,invited:g.max,confirmed:g.rsvp==='Yes'?g.count:0,checkedIn:0,status:g.rsvp,send:g.send,consent:g.consent,url:g.url})),totals:{target:700,invited:d.guests.reduce((a,g)=>a+g.max,0),confirmed:d.guests.reduce((a,g)=>a+(g.rsvp==='Yes'?g.count:0),0)}});
  }
  if(action==='prepare'&&req.method==='POST'){
   if(!admin(req))return respond(res,401,{error:'Admin authorization required'});
   return respond(res,200,await sheet('prepare'));
  }
  if(action==='queue'&&req.method==='POST'){
   if(!admin(req))return respond(res,401,{error:'Admin authorization required'});
   return respond(res,200,await sheet('queue'));
  }
  if(action==='send-one'&&req.method==='POST'){
   if(!admin(req))return respond(res,401,{error:'Admin authorization required'});
   const row=Number(req.body?.row);if(!Number.isInteger(row)||row<2)return respond(res,400,{error:'Invalid row'});
   const d=await sheet('list'),g=d.guests.find(x=>x.row===row);
   if(!g)return respond(res,404,{error:'Guest not found'});
   if(g.consent!=='Yes')return respond(res,403,{error:'Guest opt-in must be Yes'});
   if(!/^\+[1-9]\d{7,14}$/.test(g.phone))return respond(res,400,{error:'WhatsApp number must use +countrycode'});
   if(g.send==='Sent'||g.send==='Queued')return respond(res,409,{error:'Already sent or queued for the WhatsApp worker'});
   if(!/^https:\/\/[a-z0-9.-]+\/\?invite=[a-f0-9]{48,64}$/i.test(g.url))return respond(res,400,{error:'Generate links before sending'});
   // An explicit administrator request triggers one outgoing WhatsApp template message.
   let messageId;try{messageId=await cloudSend({phone:g.phone,name:g.name,url:g.url})}catch(e){await sheet('mark_send',{row,send:'Failed'});throw e}
   await sheet('mark_send',{row,send:'Sent',messageId});
   return respond(res,200,{ok:true,guest:g.name,status:'Sent'});
  }
  if(action==='checkin'&&req.method==='POST'){
   if(!admin(req))return respond(res,401,{error:'Admin authorization required'});
   return respond(res,200,await sheet('checkin',{code:req.body?.code}));
  }
  return respond(res,404,{error:'Unknown API endpoint'});
 }catch(e){console.error('Wedding API',action,String(e.message||e));const known=/^(INVALID_|RSVP_|PASS_|SET_RSVP_)/.test(String(e.message||''));return respond(res,known?400:503,{error:known?e.message:'Service unavailable or not fully configured. Please try again later.'})}
}
