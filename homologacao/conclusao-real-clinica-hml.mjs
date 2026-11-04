// Fluxo real de conclusão da Clínica. Nunca usa tickets SIM-* nem o Worker de produção.
// Desligado por padrão: necessita HML_CLINIC_REAL_COMPLETION_ENABLED=SIM_APROVADO.
// Link de conclusão é uma credencial bearer temporária, única por solicitação.
// Em qualquer erro/timeout externo não há reenvio automático.
import {tokenValido} from './reserva-hml.mjs';
const BASE='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(data,http=200)=>new Response(JSON.stringify(data),{status:http,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'
}});
async function digest(s){const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function body(req,limit=512){const text=await req.text();if(text.length>limit)throw Error();const val=JSON.parse(text);if(!val||typeof val!=='object'||Array.isArray(val))throw Error();return val;}
const allowed=env=>env.CLIGED_AMBIENTE==='homologacao'&&env.HML_DB?.prepare&&env.HML_CLINIC_REAL_COMPLETION_ENABLED==='SIM_APROVADO';
const real=r=>r?.unit_code==='CLI-MCE'&&r.location_id==='CLI-MCE:'+r.local_code&&r.state==='ABERTA'&&
 typeof r.ticket_id==='string'&&r.ticket_id.length>4&&!r.ticket_id.startsWith('SIM-');
async function update(db,key,oldState,newState){
 const r=await db.prepare('UPDATE hml_real_completion_dispatch SET state=?,updated_at=CURRENT_TIMESTAMP WHERE request_key=? AND state=?')
 .bind(newState,key,oldState).run();return r.meta?.changes>0;
}
export async function conclusaoRealClinica(request,env={}){
 if(request.method!=='POST')return reply({sucesso:false,mensagem:'Método não permitido.'},405);
 if(!allowed(env))return reply({sucesso:false,status:'DESATIVADO',mensagem:'Conclusão externa da Clínica não habilitada.'},423);
 const path=new URL(request.url).pathname;
 let b;try{b=await body(request);}catch{return reply({sucesso:false,mensagem:'Dados inválidos.'},400);}
 if(path==='/hml/real/links/emitir'){
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||!env.HML_WRITE_TOKEN||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))return reply({sucesso:false,mensagem:'Não autorizado.'},401);
  if(Object.keys(b).length!==1||!uuid.test(b.idempotency_key||''))return reply({sucesso:false,mensagem:'ID inválido.'},400);
  try{
   const key=b.idempotency_key.toLowerCase();
   const row=await env.HML_DB.prepare('SELECT unit_code,local_code,location_id,state,ticket_id FROM qr_requests WHERE idempotency_key=?').bind(key).first();
   if(!real(row))return reply({sucesso:false,mensagem:'Ticket real aberto não encontrado.'},409);
   // Preserva um único link por chamado: não cria outro se um já existir/expirar.
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const expires=Math.floor(Date.now()/1000)+30*24*3600;
   const r=await env.HML_DB.prepare('INSERT OR IGNORE INTO hml_real_completion_links(token_hash,request_key,expires_at) VALUES(?,?,?)')
     .bind(await digest(token),key,expires).run();
   if(!(r.meta?.changes>0))return reply({sucesso:false,mensagem:'Este chamado já possui um link de conclusão.'},409);
   return reply({sucesso:true,url:BASE+'/hml/atendimento-real#chave='+token,expira_em:new Date(expires*1000).toISOString()},201);
  }catch{return reply({sucesso:false,mensagem:'Falha ao emitir link.'},503);}
 }
 if(!['/hml/real/links/consultar','/hml/real/links/concluir'].includes(path))return reply({sucesso:false,mensagem:'Rota indisponível.'},404);
 if(!/^[-_A-Za-z0-9]{43}$/.test(b.token||''))return reply({sucesso:false,mensagem:'Link inválido.'},400);
 const now=Math.floor(Date.now()/1000);let row;
 try{
  row=await env.HML_DB.prepare('SELECT r.idempotency_key,r.unit_code,r.local_code,r.location_id,r.items_json,r.ticket_id,r.state FROM hml_real_completion_links l JOIN qr_requests r ON r.idempotency_key=l.request_key WHERE l.token_hash=? AND l.expires_at>?')
  .bind(await digest(b.token),now).first();
 }catch{return reply({sucesso:false,mensagem:'Falha na consulta.'},503);}
 if(!row||!real(row))return reply({sucesso:false,mensagem:'Solicitação indisponível ou link expirado.'},409);
 if(path==='/hml/real/links/consultar')return reply({sucesso:true,local:row.location_id,itens:JSON.parse(row.items_json)});
 if(Object.keys(b).sort().join(',')!=='nome,token')return reply({sucesso:false,mensagem:'Campos inválidos.'},400);
 const actor=typeof b.nome==='string'?b.nome.trim():'';
 if(actor.length<2||actor.length>100||/[\x00-\x1f\x7f]/.test(actor))
  return reply({sucesso:false,mensagem:'Nome inválido.'},400);
 if(!env.HML_TOMTICKET_TOKEN||!env.HML_GOOGLE_CHAT_WEBHOOK_URL)return reply({sucesso:false,mensagem:'Integrações não configuradas.'},503);
 // Reserva antes de chamar a API, usando primary key para evitar múltiplos finish.
 let reserved;
 try{
  reserved=await env.HML_DB.prepare("INSERT OR IGNORE INTO hml_real_completion_dispatch(request_key,ticket_id,actor,state) VALUES (?,?,?,'TOMTICKET_INICIADO')")
   .bind(row.idempotency_key,row.ticket_id,actor).run();
 }catch{return reply({sucesso:false,mensagem:'Não foi possível reservar encerramento.'},503);}
 if(!(reserved.meta?.changes>0))return reply({sucesso:false,mensagem:'Encerramento já reservado. Não repetir.'},409);
 try{
  const form=new URLSearchParams({ticket_id:row.ticket_id,message:'Solicitação concluída.\n\nRealizado por: '+actor});
  const res=await fetch('https://api.tomticket.com/v2.0/ticket/finish',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded','Authorization':'Bearer '+env.HML_TOMTICKET_TOKEN
  },body:form.toString(),redirect:'manual',signal:AbortSignal.timeout(12000)});
  const data=await res.json();
  if(!res.ok||data.error===true||data.success===false)throw Error('not-confirmed');
 }catch{
  await update(env.HML_DB,row.idempotency_key,'TOMTICKET_INICIADO','TOMTICKET_INCERTO').catch(()=>{});
  return reply({sucesso:false,status:'TOMTICKET_INCERTO',mensagem:'Confirmação incerta; confira TomTicket. Não repetir.'},502);
 }
 if(!await update(env.HML_DB,row.idempotency_key,'TOMTICKET_INICIADO','TOMTICKET_CONCLUIDO'))
  return reply({sucesso:false,status:'TOMTICKET_INCERTO',mensagem:'Fechamento recebido, registro local incerto.'},503);
 // O chat é feito depois da confirmação do encerramento real.
 if(!await update(env.HML_DB,row.idempotency_key,'TOMTICKET_CONCLUIDO','CHAT_INICIADO'))
  return reply({sucesso:false,status:'CHAT_INCERTO',mensagem:'Fechamento confirmado, notificação pendente.'},503);
 try{
  const hook=new URL(env.HML_GOOGLE_CHAT_WEBHOOK_URL);
  if(hook.protocol!=='https:'||hook.hostname!=='chat.googleapis.com')throw Error();
  const chat=await fetch(hook.toString(),{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({text:'✅ Solicitação concluída.\n\nUnidade: Clínica CLIGED Macaé\nLocal: '+row.location_id+
    '\nServiços: '+JSON.parse(row.items_json).join(', ')+'\nRealizado por: '+actor+
    '\nTomTicket: '+row.ticket_id}),redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(!chat.ok)throw Error();
 }catch{
  await update(env.HML_DB,row.idempotency_key,'CHAT_INICIADO','CHAT_INCERTO').catch(()=>{});
  return reply({sucesso:false,status:'CHAT_INCERTO',ticket_id:row.ticket_id,
   mensagem:'TomTicket concluído, mas Chat não confirmado. Não repetir encerramento.'},502);
 }
 await update(env.HML_DB,row.idempotency_key,'CHAT_INICIADO','CHAT_ENVIADO');
 await env.HML_DB.prepare("UPDATE qr_requests SET state='CONCLUIDA',actor=?,updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND state='ABERTA'")
  .bind(actor,row.idempotency_key).run();
 return reply({sucesso:true,status:'CHAT_ENVIADO',ticket_id:row.ticket_id,
  mensagem:'TomTicket concluído e Google Chat notificado.'});
}
