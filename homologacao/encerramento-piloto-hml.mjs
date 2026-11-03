// Encerramento REAL do único ticket de teste. Desligado por padrão.
// Operação administrativa, não utilizável pelo formulário público da colaboradora.
// Não realiza reenvio automático em falhas ambíguas.
import {tokenValido} from './reserva-hml.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const respond=(data,http=200)=>new Response(JSON.stringify(data),{status:http,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'
}});
export async function encerrarPilotoHml(request,env={}){
 if(request.method!=='POST')return respond({sucesso:false,mensagem:'Método não permitido.'},405);
 if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)
  return respond({sucesso:false,mensagem:'Ambiente indisponível.'},503);
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))
  return respond({sucesso:false,mensagem:'Não autorizado.'},401);
 if(env.HML_REAL_CLOSURE_ENABLED!=='SIM_ENCERRAMENTO_UNICO'||
    typeof env.HML_TOMTICKET_TOKEN!=='string'||!env.HML_TOMTICKET_TOKEN||
    typeof env.HML_PILOT_REQUEST_KEY!=='string')
  return respond({sucesso:false,status:'DESATIVADO',mensagem:'Encerramento real bloqueado.'},423);
 let b;
 try{
  const raw=await request.text();
  if(raw.length>400)throw Error();
  b=JSON.parse(raw);
  if(!b||Object.keys(b).sort().join(',')!=='confirmacao,idempotency_key'||!UUID.test(b.idempotency_key)||
    b.confirmacao!=='CONFIRMO ENCERRAMENTO REAL DO CHAMADO DE TESTE')throw Error();
 }catch{return respond({sucesso:false,mensagem:'Confirmação ou identificador inválidos.'},400);}
 const key=b.idempotency_key.toLowerCase();
 if(key!==env.HML_PILOT_REQUEST_KEY.toLowerCase())
  return respond({sucesso:false,mensagem:'Solicitação não autorizada.'},403);
 try{
  const pilot=await env.HML_DB.prepare(
   "SELECT p.ticket_id,p.status,r.unit_code,r.location_id FROM hml_external_pilots p JOIN qr_requests r ON r.idempotency_key=p.request_key WHERE p.request_key=?"
  ).bind(key).first();
  if(!pilot||pilot.status!=='NOTIFICADO'||!pilot.ticket_id||!pilot.location_id?.startsWith('CLI-MCE:')||
     pilot.unit_code!=='CLI-MCE'||pilot.ticket_id.startsWith('SIM-'))
    return respond({sucesso:false,mensagem:'Ticket externo de teste não elegível.'},409);
  // Uma reserva CAS garantida pela primary key; impede múltiplos finish sob concorrência.
  const reserved=await env.HML_DB.prepare(
    "INSERT OR IGNORE INTO hml_pilot_real_closure(request_key,ticket_id,state) VALUES (?,?,'INICIADA')"
  ).bind(key,String(pilot.ticket_id)).run();
  if(!(reserved.meta?.changes>0))
   return respond({sucesso:false,mensagem:'Encerramento já reservado. Nunca repetir automaticamente.'},409);
  let confirmed=false;
  try{
   const params=new URLSearchParams({ticket_id:String(pilot.ticket_id),
    message:'Encerramento técnico do chamado único [TESTE HML CLIGED], autorizado e executado pela administração da homologação.'});
   const r=await fetch('https://api.tomticket.com/v2.0/ticket/finish',{
    method:'POST',headers:{
     'Content-Type':'application/x-www-form-urlencoded',
     'Authorization':'Bearer '+env.HML_TOMTICKET_TOKEN
    },body:params.toString(),redirect:'manual',signal:AbortSignal.timeout(12000)
   });
   const data=await r.json();
   confirmed=r.ok&&data.error!==true&&data.success!==false;
  }catch{confirmed=false;}
  const state=confirmed?'CONCLUIDA':'INCERTA';
  await env.HML_DB.prepare(
    'UPDATE hml_pilot_real_closure SET state=?,updated_at=CURRENT_TIMESTAMP WHERE request_key=? AND state=?'
  ).bind(state,key,'INICIADA').run();
  if(!confirmed)return respond({sucesso:false,status:'INCERTA',ticket_id:String(pilot.ticket_id),
   mensagem:'Não foi possível confirmar o encerramento. Verifique o TomTicket; não repita.'},502);
  return respond({sucesso:true,status:'CONCLUIDA',ticket_id:String(pilot.ticket_id),
   mensagem:'Encerramento real do ticket de TESTE confirmado pelo TomTicket.'});
 }catch{
  return respond({sucesso:false,status:'INCERTA',
   mensagem:'Falha ao consultar ou persistir. Não repita antes de auditar o banco D1.'},503);
 }
}
