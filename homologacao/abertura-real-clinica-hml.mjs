// Apenas CLI-MCE, ambiente HML isolado. Abrir tickets reais exige
// HML_CLINIC_LIVE_ENABLED=SIM_APROVADO. Nenhum retry externo automático.
import catalogo from './catalogo-unidades.json' with {type:'json'};
import {prepararSolicitacao} from './operacao-core.mjs';
const path='/hml/clinica/solicitar';
const reply=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'
}});
const ready=e=>e.CLIGED_AMBIENTE==='homologacao'&&e.HML_CLINIC_LIVE_ENABLED==='SIM_APROVADO'&&
 e.HML_DB?.prepare&&e.HML_TOMTICKET_TOKEN&&e.HML_PILOT_CUSTOMER_ID&&
 e.HML_PILOT_DEPARTMENT_ID&&e.HML_PILOT_OPERATOR_ID&&e.HML_GOOGLE_CHAT_WEBHOOK_URL;
async function change(db,key,from,to,ticket=null){
 const r=await db.prepare("UPDATE hml_clinic_live_dispatch SET stage=?,ticket_id=COALESCE(?,ticket_id),updated_at=CURRENT_TIMESTAMP WHERE request_key=? AND stage=?")
  .bind(to,ticket,key,from).run();return r.meta?.changes>0;
}
async function external(env,route,body,formData=false){
 const headers={Authorization:'Bearer '+env.HML_TOMTICKET_TOKEN};
 if(!formData)headers['Content-Type']='application/x-www-form-urlencoded';
 const r=await fetch('https://api.tomticket.com/v2.0/ticket/'+route,
  {method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(12000)});
 const data=await r.json();
 return {ok:r.ok&&data.error!==true&&data.success!==false,data};
}
async function hash(s){
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function uncertain(env,key,from,stage,publicMessage){
 await change(env.HML_DB,key,from,stage).catch(()=>{});
 await env.HML_DB.prepare("UPDATE qr_requests SET state='ENVIO_INCERTO',updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND state='ENVIO_INICIADO'")
  .bind(key).run().catch(()=>{});
 return reply({sucesso:false,estado:'PENDENTE_VERIFICACAO',mensagem:publicMessage+
  ' Se sua solicitação já foi registrada, não tente abrir novamente; a equipe verificará.'},503);
}
export async function solicitarClinicaReal(request,env={}){
 if(new URL(request.url).pathname!==path||request.method!=='POST')
  return reply({sucesso:false,mensagem:'Método não permitido.'},405);
 if(!ready(env))return reply({sucesso:false,estado:'DESATIVADO',mensagem:'Solicitações reais ainda não liberadas.'},423);
 let pedido;
 try{
  const raw=await request.text();if(raw.length>2048)throw Error();
  pedido=await prepararSolicitacao(catalogo,JSON.parse(raw));
  if(pedido.unit_code!=='CLI-MCE')return reply({sucesso:false,mensagem:'Unidade não autorizada.'},403);
 }catch{return reply({sucesso:false,mensagem:'Local ou serviços inválidos.'},400);}
 const key=pedido.idempotency_key,db=env.HML_DB;
 try{
  const existing=await db.prepare('SELECT fingerprint,state,ticket_id FROM qr_requests WHERE idempotency_key=?').bind(key).first();
  if(existing)return reply(existing.fingerprint===pedido.fingerprint?
   {sucesso:true,duplicado:true,estado:existing.state,mensagem:'Solicitação já recebida. Não reenviar.'}:
   {sucesso:false,mensagem:'Identificador reutilizado com outros dados.'},existing.fingerprint===pedido.fingerprint?200:409);
  // Limite por banheiro: 1 nova solicitação por 60 s. UPSERT condicionado atômico.
  const now=Math.floor(Date.now()/1000);
  const limiter=await db.prepare("INSERT INTO hml_clinic_live_rate(location_id,last_sent_at) VALUES (?,?) ON CONFLICT(location_id) DO UPDATE SET last_sent_at=excluded.last_sent_at WHERE hml_clinic_live_rate.last_sent_at<=?")
   .bind(pedido.location_id,now,now-60).run();
  if(!(limiter.meta?.changes>0))return reply({sucesso:false,mensagem:'Aguarde um minuto para uma nova solicitação neste banheiro.'},429);
  const inserted=await db.prepare("INSERT OR IGNORE INTO qr_requests(idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state) VALUES (?,?,?,?,?,?,'RESERVADA')")
    .bind(key,pedido.fingerprint,pedido.unit_code,pedido.local_code,pedido.location_id,JSON.stringify(pedido.servicos)).run();
  if(!(inserted.meta?.changes>0))return reply({sucesso:false,mensagem:'Solicitação já registrada.'},409);
  const reserved=await db.prepare("INSERT OR IGNORE INTO hml_clinic_live_dispatch(request_key,stage) VALUES (?,'CRIANDO')").bind(key).run();
  if(!(reserved.meta?.changes>0))return reply({sucesso:false,mensagem:'Solicitação já reservada.'},409);
  await db.prepare("UPDATE qr_requests SET state='ENVIO_INICIADO' WHERE idempotency_key=? AND state='RESERVADA'").bind(key).run();
  let created;
  try{
   created=await external(env,'new',new URLSearchParams({
    customer_id:env.HML_PILOT_CUSTOMER_ID,customer_id_type:'E',
    department_id:env.HML_PILOT_DEPARTMENT_ID,category_id:pedido.categoria,
    subject:pedido.assunto,message:pedido.mensagem,priority:pedido.prioridade
   }).toString());
  }catch{return uncertain(env,key,'CRIANDO','ENVIO_INCERTO','Não foi possível confirmar a criação do chamado.');}
  const ticket=created.data?.ticket_id||created.data?.id||created.data?.data?.ticket_id||created.data?.data?.id;
  if(!created.ok||!ticket)return uncertain(env,key,'CRIANDO','ENVIO_INCERTO','O TomTicket não confirmou a abertura.');
  const ticketId=String(ticket);
  await db.prepare('UPDATE qr_requests SET ticket_id=? WHERE idempotency_key=? AND state=?')
    .bind(ticketId,key,'ENVIO_INICIADO').run();
  if(!await change(db,key,'CRIANDO','CRIADO',ticketId))
   return reply({sucesso:false,estado:'PENDENTE_VERIFICACAO',mensagem:'Chamado criado; verificação administrativa necessária.'},503);
  await change(db,key,'CRIADO','VINCULANDO');
  let transferred;
  try{
   const form=new FormData();form.append('ticket_id',ticketId);form.append('operator_id',env.HML_PILOT_OPERATOR_ID);
   transferred=await external(env,'transfer',form,true);
  }catch{return uncertain(env,key,'VINCULANDO','TRANSFERENCIA_INCERTA','Chamado criado, mas encaminhamento não confirmado.');}
  const same=String(transferred.data?.message||'').toLowerCase().includes('same operator');
  if(!transferred.ok&&!same)return uncertain(env,key,'VINCULANDO','TRANSFERENCIA_INCERTA','Encaminhamento não confirmado.');
  await change(db,key,'VINCULANDO','VINCULADO');
  // Cria link bearer de conclusão: único, não expõe o segredo na listagem pública.
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const link='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev/hml/atendimento-real#chave='+token;
  await change(db,key,'VINCULADO','LINKANDO');
  try{
   const linkSaved=await db.prepare('INSERT OR IGNORE INTO hml_real_completion_links(token_hash,request_key,expires_at) VALUES (?,?,?)')
    .bind(await hash(token),key,Math.floor(Date.now()/1000)+48*3600).run();
   if(!(linkSaved.meta?.changes>0))return uncertain(env,key,'LINKANDO','LINK_INCERTO','Link de conclusão já reservado.');
  }catch{return uncertain(env,key,'LINKANDO','LINK_INCERTO','Não foi possível criar o link de conclusão.');}
  let insertedLink;
  try{insertedLink=await external(env,'reply/customer',new URLSearchParams({
   ticket_id:ticketId,message:'🔗 CONCLUIR SOLICITAÇÃO:\n\n'+link
  }).toString());}catch{return uncertain(env,key,'LINKANDO','LINK_INCERTO','Link não confirmado no TomTicket.');}
  if(!insertedLink.ok)return uncertain(env,key,'LINKANDO','LINK_INCERTO','Link não confirmado no TomTicket.');
  await change(db,key,'LINKANDO','LINKADO');
  await change(db,key,'LINKADO','CHAT_INICIADO');
  try{
   const hook=new URL(env.HML_GOOGLE_CHAT_WEBHOOK_URL);
   if(hook.hostname!=='chat.googleapis.com'||hook.protocol!=='https:')throw Error();
   const r=await fetch(hook.toString(),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:'🚨 NOVA SOLICITAÇÃO CLÍNICA CLIGED\nLocal: '+pedido.local_code+' — '+pedido.local_name+
     '\nServiços: '+pedido.servicos.join(', ')+'\nChamado: '+ticketId+'\nConcluir: '+link}),
    redirect:'manual',signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error();
  }catch{return uncertain(env,key,'CHAT_INICIADO','CHAT_INCERTO','Chamado criado; notificação não confirmada.');}
  await change(db,key,'CHAT_INICIADO','ATIVO');
  await db.prepare("UPDATE qr_requests SET state='ABERTA',updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND state='ENVIO_INICIADO'").bind(key).run();
  return reply({sucesso:true,estado:'ABERTA',location_id:pedido.location_id,
    mensagem:'Solicitação enviada. A equipe foi notificada.'},201);
 }catch{return reply({sucesso:false,estado:'PENDENTE_VERIFICACAO',
   mensagem:'Resultado não confirmado. Não envie novamente; a equipe verificará.'},503);}
}
