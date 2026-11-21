/**
 * Sakshi & Pinak Wedding RSVP — Google Sheets storage adapter.
 * Paste in Extensions > Apps Script attached to "Pinak Wedding Guest List".
 * Script Properties:
 *   RSVP_WEBHOOK_SECRET: random 32+ character secret shared only with Vercel
 *   RSVP_PUBLIC_URL: https://your-wedding-site.vercel.app
 * Deploy > Web app: Execute as "Me", access "Anyone".
 * Do NOT expose the secret, webapp URL plus secret, QR codes, or invitation tokens publicly.
 * Original Wedding/All sheets are not modified. Only "Wedding RSVP Register" is used.
 */
const TAB='Wedding RSVP Register';
const H={ID:0,NAME:1,PHONE:2,MAX:3,RSVP:4,COUNT:5,TOKEN:6,LINK:7,SEND:8,MESSAGE_ID:9,SENT_AT:10,UPDATED_AT:11,CHECKED:12,CONSENT:13,NOTES:14,PASSES:15};
const now=()=>new Date().toISOString();
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function prop(k){return PropertiesService.getScriptProperties().getProperty(k)||'';}
function secureToken(){return Array.from({length:6},()=>Utilities.getUuid().replace(/-/g,'')).join('').slice(0,64);}
function data(){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);if(!s)throw Error('RSVP_TAB_MISSING');return s;}
function sheetRows(s){return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,16).getValues().map((v,i)=>({row:i+2,v}));}
function validNumber(s){return /^\+[1-9]\d{7,14}$/.test(String(s||'').trim());}
function rowByToken(s,token){if(!/^[a-f0-9]{48,64}$/i.test(String(token||'')))throw Error('INVALID_INVITATION');const f=s.getRange(2,7,Math.max(1,s.getLastRow()-1),1).createTextFinder(String(token)).matchEntireCell(true).findNext();if(!f)throw Error('INVALID_INVITATION');return f.getRow();}
function sanitized(v){return {name:String(v[H.NAME]||'').slice(0,100),max:Number(v[H.MAX])||1,rsvp:String(v[H.RSVP]||'Pending'),count:Number(v[H.COUNT])||0};}
function passes(v){try{const p=JSON.parse(String(v[H.PASSES]||'[]'));return Array.isArray(p)?p:[]}catch{return[]}}
function updatePasses(v,count){const old=passes(v),p=[];for(let i=0;i<count;i++){const previous=old[i];p.push(previous&&previous.code?previous:{code:secureToken(),checked:false})}return p;}
function callHandler(a){
 const s=data();
 if(a.action==='design_read'){
   try{return JSON.parse(prop('WEDDING_DESIGN_JSON')||'null')}catch{return null}
 }
 if(a.action==='design_write'){
   if(!a.design||typeof a.design!=='object')throw Error('INVALID_DESIGN');
   PropertiesService.getScriptProperties().setProperty('WEDDING_DESIGN_JSON',JSON.stringify(a.design).slice(0,7000));
   return {saved:true};
 }
 if(a.action==='lookup'){
  const row=rowByToken(s,a.token),v=s.getRange(row,1,1,16).getValues()[0];
  return {guest:sanitized(v),passes:passes(v).map((p,i)=>({slot:i+1,checked:!!p.checked})),ready:true};
 }
 if(a.action==='rsvp'){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
   const row=rowByToken(s,a.token),v=s.getRange(row,1,1,16).getValues()[0];
   const status=a.rsvp==='Yes'?'Yes':a.rsvp==='No'?'No':null;
   if(!status)throw Error('INVALID_RSVP');
   const max=Number(v[H.MAX]);
   const count=status==='Yes'?Number(a.count):0;
   if(!Number.isInteger(count)||count<0||count>max||(status==='Yes'&&count<1))throw Error('INVALID_GUEST_COUNT');
   if(passes(v).some(p=>p.checked))throw Error('RSVP_LOCKED_AFTER_CHECKIN');
   const ps=status==='Yes'?updatePasses(v,count):[];
   // Only RSVP, count, update time and pass JSON are changed.
   s.getRange(row,5,1,2).setValues([[status,count]]);
   s.getRange(row,12).setValue(now());
   s.getRange(row,13).setValue(0);
   s.getRange(row,16).setValue(JSON.stringify(ps));
   SpreadsheetApp.flush();
   return {guest:{name:String(v[H.NAME]),max,rsvp:status,count},passes:ps.map((p,i)=>({slot:i+1,checked:false}))};
  }finally{lock.releaseLock()}
 }
 if(a.action==='qr'){
  const row=rowByToken(s,a.token),v=s.getRange(row,1,1,16).getValues()[0];
  if(v[H.RSVP]!=='Yes')throw Error('RSVP_REQUIRED');
  const slot=Number(a.slot),p=passes(v);
  if(!Number.isInteger(slot)||slot<1||slot>p.length)throw Error('PASS_NOT_FOUND');
  return {code:p[slot-1].code,name:v[H.NAME],slot,guestCount:p.length};
 }
 if(a.action==='list'){
  return {guests:sheetRows(s).filter(x=>String(x.v[H.NAME]).trim()).map(({row,v})=>({row,name:String(v[H.NAME]),phone:String(v[H.PHONE]),max:Number(v[H.MAX])||0,rsvp:String(v[H.RSVP]||'Pending'),count:Number(v[H.COUNT])||0,send:String(v[H.SEND]||'Not Sent'),consent:String(v[H.CONSENT]||'Unknown'),url:String(v[H.LINK]||'')}))};
 }
 if(a.action==='prepare'){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
   const url=prop('RSVP_PUBLIC_URL').replace(/\/$/,'');
   if(!/^https:\/\//.test(url))throw Error('SET_RSVP_PUBLIC_URL');
   const rows=sheetRows(s);if(!rows.length)return {prepared:0,skipped:0};
   const ids=[],statuses=[],links=[];let prepared=0,skipped=0;
   for(const {v} of rows){
    const name=String(v[H.NAME]||'').trim(),max=Number(v[H.MAX]);
    const valid=name&&Number.isInteger(max)&&max>=1&&max<=30;
    const id=valid?String(v[H.ID]||Utilities.getUuid()):v[H.ID];
    const token=valid?String(v[H.TOKEN]||secureToken()):v[H.TOKEN];
    ids.push([id]);statuses.push([valid?String(v[H.RSVP]||'Pending'):v[H.RSVP]]);
    links.push([token,valid?url+'/?invite='+encodeURIComponent(token):v[H.LINK],valid?String(v[H.SEND]||'Not Sent'):v[H.SEND]]);
    if(valid)prepared++;else skipped++;
   }
   s.getRange(2,1,ids.length,1).setValues(ids);
   s.getRange(2,5,statuses.length,1).setValues(statuses);
   s.getRange(2,7,links.length,3).setValues(links);
   SpreadsheetApp.flush();return {prepared,skipped};
  }finally{lock.releaseLock()}
 }
 if(a.action==='queue'){
  const rows=sheetRows(s);if(!rows.length)return {queued:0,skipped:0};
  let queued=0,skipped=0;
  const statuses=rows.map(({v})=>{
   const status=String(v[H.SEND]||'Not Sent');
   if(['Sent','Queued'].includes(status))return [status];
   if(String(v[H.CONSENT])!=='Yes'||!validNumber(v[H.PHONE])||!String(v[H.LINK]).startsWith('https://')){skipped++;return [status]}
   queued++;return ['Queued'];
  });
  s.getRange(2,9,statuses.length,1).setValues(statuses);
  return {queued,skipped};
 }
 if(a.action==='mark_send'){
  const row=Number(a.row),allowed=['Queued','Sent','Failed','Not Sent'];
  if(!Number.isInteger(row)||row<2||row>s.getLastRow()||!allowed.includes(a.send))throw Error('INVALID_SEND_UPDATE');
  s.getRange(row,9,1,3).setValues([[a.send,String(a.messageId||'').slice(0,150),a.send==='Sent'?now():'']]);
  return {updated:true};
 }
 if(a.action==='checkin'){
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
   const code=String(a.code||'').replace(/^PS-WEDDING:/,'');
   if(!/^[a-f0-9]{48,64}$/i.test(code))throw Error('INVALID_CODE');
   for(const item of sheetRows(s)){
    const p=passes(item.v),idx=p.findIndex(x=>x.code===code);
    if(idx<0)continue;
    if(item.v[H.RSVP]!=='Yes'||p[idx].checked)throw Error('INVALID_OR_ALREADY_CHECKED');
    p[idx].checked=true;
    s.getRange(item.row,16).setValue(JSON.stringify(p));
    s.getRange(item.row,13).setValue(p.filter(x=>x.checked).length);
    return {checked:true,guest:item.v[H.NAME],slot:idx+1};
   }
   throw Error('INVALID_CODE');
  }finally{lock.releaseLock()}
 }
 throw Error('UNKNOWN_ACTION');
}
function doPost(e){
 try{
  const a=JSON.parse(e.postData?.contents||'{}'),key=prop('RSVP_WEBHOOK_SECRET');
  if(key.length<32||typeof a.secret!=='string'||a.secret!==key)return json({ok:false,error:'UNAUTHORIZED'});
  return json({ok:true,result:callHandler(a)});
 }catch(err){return json({ok:false,error:String(err.message||err).slice(0,140)})}
}
function doGet(){return json({ok:false,error:'POST_ONLY'})}

/** Install this time-driven worker only AFTER the approved WhatsApp template,
 * verified sender, opt-in consent, and test messages have all been confirmed.
 * The worker processes up to 10 queued rows every five minutes. */
function installWhatsAppQueueTrigger(){
 const found=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='whatsappQueueWorker');
 if(!found)ScriptApp.newTrigger('whatsappQueueWorker').timeBased().everyMinutes(5).create();
}
function stopWhatsAppQueueTrigger(){
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='whatsappQueueWorker').forEach(ScriptApp.deleteTrigger);
}
function whatsappQueueWorker(){
 const token=prop('META_WHATSAPP_ACCESS_TOKEN'),id=prop('META_WHATSAPP_PHONE_NUMBER_ID'),template=prop('META_WHATSAPP_TEMPLATE_NAME'),language=prop('META_WHATSAPP_TEMPLATE_LANGUAGE')||'en';
 if(!token||!id||!template)throw Error('META_WHATSAPP_CREDENTIALS_NOT_SET');
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  const s=data();let processed=0;
  for(const {row,v} of sheetRows(s)){
   if(processed>=10)break;
   if(String(v[H.SEND])!=='Queued')continue;
   if(String(v[H.CONSENT])!=='Yes'||!validNumber(v[H.PHONE])||!/^https:\/\//.test(String(v[H.LINK]))){s.getRange(row,9).setValue('Failed');continue;}
   const body={messaging_product:'whatsapp',to:String(v[H.PHONE]).replace(/^\+/,''),type:'template',
     template:{name:template,language:{code:language},components:[{type:'body',parameters:[
       {type:'text',text:String(v[H.NAME]).slice(0,100)},{type:'text',text:String(v[H.LINK])}]}]}};
   try{
    const response=UrlFetchApp.fetch('https://graph.facebook.com/v23.0/'+encodeURIComponent(id)+'/messages',{
      method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(body),muteHttpExceptions:true});
    const result=JSON.parse(response.getContentText()||'{}');
    if(response.getResponseCode()<200||response.getResponseCode()>=300||!result.messages?.[0]?.id)throw Error('WHATSAPP_REJECTED');
    s.getRange(row,9,1,3).setValues([['Sent',String(result.messages[0].id),now()]]);
   }catch(err){
    s.getRange(row,9).setValue('Failed');
    console.error('WhatsApp queued send failed for row '+row+': '+String(err.message).slice(0,150));
   }
   processed++;
   Utilities.sleep(250);
  }
 }finally{lock.releaseLock()}
}
