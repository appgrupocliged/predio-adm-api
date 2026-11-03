// Piloto externo HML: EXECUÇÃO DESLIGADA POR PADRÃO.
// Nunca importa worker.js nem usa secrets de produção.
// Sem fechamento real: requer posterior etapa com autenticação da colaboradora.
// Uma única reserva GLOBAL e atômica no D1; estados incertos não têm reenvio automático.
import {tokenValido} from './reserva-hml.mjs';
import catalogo from './catalogo-unidades.json' with {type:'json'};
import {prepararSolicitacao} from './operacao-core.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'
}});
const output=(status,details={})=>({sucesso:status==='NOTIFICADO',modo:'PILOTO_EXTERNO_CONTROLADO',status,...details});

function configValida(env) {
  if(env.HML_EXTERNAL_PILOT_ENABLED!=='SIM_UM_CHAMADO')return false;
  const required=['HML_TOMTICKET_TOKEN','HML_GOOGLE_CHAT_WEBHOOK_URL','HML_PILOT_DEPARTMENT_ID','HML_PILOT_OPERATOR_ID','HML_PILOT_CUSTOMER_ID','HML_PILOT_REQUEST_KEY'];
  if(required.some(key=>typeof env[key]!=='string'||!env[key].trim()))return false;
  const hook=new URL(env.HML_GOOGLE_CHAT_WEBHOOK_URL);
  if(hook.protocol!=='https:'||hook.hostname!=='chat.googleapis.com'||!hook.pathname.startsWith('/v1/spaces/'))
    return false;
  if(!/^[a-zA-Z0-9]+$/.test(env.HML_PILOT_DEPARTMENT_ID)||!/^[a-zA-Z0-9]+$/.test(env.HML_PILOT_OPERATOR_ID))
    return false;
  return true;
}
async function parseTomTicket(response){
 const text=await response.text();
 let data;
 try{data=JSON.parse(text);}catch{return {ok:false,data:{}};}
 return {ok:response.ok&&data.error!==true&&data.success!==false,data};
}
async function update(db,key,from,to,ticketId=null){
 const r=await db.prepare(
  'UPDATE hml_external_pilots SET status=?,ticket_id=COALESCE(?,ticket_id),updated_at=CURRENT_TIMESTAMP WHERE request_key=? AND status=?'
 ).bind(to,ticketId,key,from).run();
 return r.meta?.changes>0;
}
async function callTomTicket(env,route,body,isForm=false) {
 const headers={Authorization:'Bearer '+env.HML_TOMTICKET_TOKEN};
 if(!isForm)headers['Content-Type']='application/x-www-form-urlencoded';
 const response=await fetch('https://api.tomticket.com/v2.0/ticket/'+route,{
  method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(12000)
 });
 return parseTomTicket(response);
}
export async function pilotoExternoHml(request,env={}){
 if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
 if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)
   return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))
   return json({sucesso:false,mensagem:'Não autorizado.'},401);
 let body;
 try{const raw=await request.text();if(raw.length>512)throw Error();
   body=JSON.parse(raw);
   if(!body||Object.keys(body).sort().join(',')!=='confirmacao,idempotency_key'||
      !UUID.test(body.idempotency_key)||body.confirmacao!=='CONFIRMO UM CHAMADO REAL DE TESTE')throw Error();
 }catch{return json({sucesso:false,mensagem:'Confirmação ou identificador inválidos.'},400);}
 const key=body.idempotency_key.toLowerCase();
 if(!configValida(env))return json({
  sucesso:false,status:'DESATIVADO',
  mensagem:'Piloto externo bloqueado. Configure credenciais e habilitação específicas de homologação no Cloudflare.'
 },423);
 // Além da aprovação administrativa, somente a chave exata previamente autorizada pode ser usada.
 if(!UUID.test(env.HML_PILOT_REQUEST_KEY)||key!==env.HML_PILOT_REQUEST_KEY.toLowerCase())
  return json({sucesso:false,mensagem:'Esta solicitação não está autorizada para o piloto único.'},403);
 let row;
 try{
  row=await env.HML_DB.prepare(
   'SELECT idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state,ticket_id FROM qr_requests WHERE idempotency_key=?'
  ).bind(key).first();
  if(!row||row.unit_code!=='CLI-MCE'||row.location_id!=='CLI-MCE:'+row.local_code||
     !['ABERTA','CONCLUIDA'].includes(row.state)||row.ticket_id!=='SIM-'+key)
    return json({sucesso:false,mensagem:'Solicitação simulada válida da Clínica não encontrada.'},409);
  const items=JSON.parse(row.items_json);
  const pedido=await prepararSolicitacao(catalogo,{
   idempotency_key:key,unit_code:row.unit_code,local_code:row.local_code,items
  });
  if(pedido.fingerprint!==row.fingerprint)return json({sucesso:false,mensagem:'Fingerprint divergente.'},409);
  // A única chamada que pode executar o fluxo deve conquistar a reserva.
  const reservation=await env.HML_DB.prepare(
   "INSERT OR IGNORE INTO hml_external_pilots(request_key,status) VALUES (?,'RESERVADO')"
  ).bind(key).run();
  // O UNIQUE(pilot_slot) impede simultaneamente até pedidos com chaves distintas.
  if(!(reservation.meta?.changes>0)){
    const previous=await env.HML_DB.prepare(
      'SELECT status,ticket_id FROM hml_external_pilots WHERE request_key=?'
    ).bind(key).first();
    return json(output(previous?.status??'BLOQUEIO_GLOBAL',{
      sucesso:false,mensagem:'Piloto já reservado ou esgotado globalmente. Não repetir: confira o estado e reconcilie manualmente.',
      ticket_id:previous?.ticket_id??null
    }),409);
  }
  if(!await update(env.HML_DB,key,'RESERVADO','CRIANDO'))
    return json(output('CRIACAO_INCERTA',{mensagem:'Falha ao registrar a transição inicial.'}),503);
  let created;
  try {
    const form=new URLSearchParams({
     customer_id:env.HML_PILOT_CUSTOMER_ID,customer_id_type:'E',
     department_id:env.HML_PILOT_DEPARTMENT_ID,
     category_id:pedido.categoria,
     subject:'[TESTE HML CLIGED] '+pedido.assunto,
     message:pedido.mensagem+'\n\n[TESTE CONTROLADO DE HOMOLOGACAO - NAO EXECUTAR OPERACIONALMENTE]\nChave: '+key,
     priority:pedido.prioridade
    });
    created=await callTomTicket(env,'new',form.toString());
  } catch {
    await update(env.HML_DB,key,'CRIANDO','CRIACAO_INCERTA');
    return json(output('CRIACAO_INCERTA',{mensagem:'Resultado da criação desconhecido. Não repetir automaticamente.'}),502);
  }
  if(!created.ok){
    await update(env.HML_DB,key,'CRIANDO','CRIACAO_INCERTA');
    return json(output('CRIACAO_INCERTA',{mensagem:'TomTicket não confirmou criação. Verifique externamente antes de qualquer repetição.'}),502);
  }
  const ticketId=created.data.ticket_id||created.data.id||created.data.data?.ticket_id||created.data.data?.id;
  if(!ticketId||!String(ticketId).trim()){
    await update(env.HML_DB,key,'CRIANDO','CRIACAO_INCERTA');
    return json(output('CRIACAO_INCERTA',{mensagem:'TomTicket não devolveu ticket_id; consulte o painel antes de qualquer repetição.'}),502);
  }
  const ticket=String(ticketId);
  if(!await update(env.HML_DB,key,'CRIANDO','CRIADO',ticket))
    return json(output('CRIACAO_INCERTA',{mensagem:'Chamado criado, mas persistência local incerta.',ticket_id:ticket}),503);
  if(!await update(env.HML_DB,key,'CRIADO','VINCULANDO'))
    return json(output('VINCULO_INCERTO',{mensagem:'Chamado criado. Transferência não iniciada.',ticket_id:ticket}),503);
  let transfer;
  try {
    const form=new FormData();
    form.append('ticket_id',ticket);
    form.append('operator_id',env.HML_PILOT_OPERATOR_ID);
    transfer=await callTomTicket(env,'transfer',form,true);
  }catch{
    await update(env.HML_DB,key,'VINCULANDO','VINCULO_INCERTO');
    return json(output('VINCULO_INCERTO',{mensagem:'Resultado da transferência desconhecido.',ticket_id:ticket}),502);
  }
  if(!transfer.ok&&!String(transfer.data?.message||'').toLowerCase().includes('same operator')){
    await update(env.HML_DB,key,'VINCULANDO','VINCULO_INCERTO');
    return json(output('VINCULO_INCERTO',{mensagem:'TomTicket não confirmou vínculo com operador.',ticket_id:ticket}),502);
  }
  if(!await update(env.HML_DB,key,'VINCULANDO','VINCULADO'))
    return json(output('VINCULO_INCERTO',{mensagem:'Vínculo executado; persistência local incerta.',ticket_id:ticket}),503);
  if(!await update(env.HML_DB,key,'VINCULADO','NOTIFICANDO'))
    return json(output('CHAT_INCERTO',{mensagem:'Vínculo concluído; notificação não iniciada.',ticket_id:ticket}),503);
  try{
    const chat=await fetch(env.HML_GOOGLE_CHAT_WEBHOOK_URL,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:'[TESTE DE HOMOLOGACAO CLIGED]\nChamado TomTicket: '+ticket+
         '\nUnidade: '+pedido.unit_name+'\nLocal: '+pedido.local_code+' — '+pedido.local_name+
         '\nServiços: '+pedido.servicos.join(', ')+
         '\nEste é um teste controlado; não atender nem encerrar como produção.'}),
      redirect:'error',signal:AbortSignal.timeout(12000)
    });
    if(!chat.ok)throw Error('not-confirmed');
  }catch{
    await update(env.HML_DB,key,'NOTIFICANDO','CHAT_INCERTO');
    return json(output('CHAT_INCERTO',{mensagem:'Chamado criado e vinculado; notificação Google Chat não confirmada.',ticket_id:ticket}),502);
  }
  if(!await update(env.HML_DB,key,'NOTIFICANDO','NOTIFICADO'))
    return json(output('CHAT_INCERTO',{mensagem:'Chat recebeu requisição; persistência local incerta.',ticket_id:ticket}),503);
  return json(output('NOTIFICADO',{
    ticket_id:ticket,mensagem:'Chamado real de TESTE criado, atribuído e notificado. Encerramento real não habilitado.'
  }));
 }catch{
  // Importante: após reserva, não refazer operações externas pelo mesmo request_key.
  return json({sucesso:false,modo:'PILOTO_EXTERNO_CONTROLADO',
    mensagem:'Falha interna. Verifique ledger HML e TomTicket antes de qualquer novo teste.'},503);
 }
}
