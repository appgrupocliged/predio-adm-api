// Orquestra somente dados sintéticos e link HML. Sem integrações externas.
import catalogo from './catalogo-unidades.json' with {type:'json'};
import {prepararSolicitacao} from './operacao-core.mjs';
import {reservar} from './persistencia-d1.mjs';
import {tokenValido} from './reserva-hml.mjs';
import {linksConclusao} from './links-conclusao-hml.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
export async function simularCompleto(request,env={}){
 if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
 if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare)return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
 const authorization=request.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer ')||!await tokenValido(authorization.slice(7),env.HML_WRITE_TOKEN))return json({sucesso:false,mensagem:'Não autorizado.'},401);
 let pedido;
 try{const raw=await request.text();if(raw.length>4096)throw Error('Corpo inválido');pedido=await prepararSolicitacao(catalogo,JSON.parse(raw));}
 catch{return json({sucesso:false,mensagem:'Dados da simulação inválidos.'},400);}
 try{
  const reserva=await reservar(env.HML_DB,pedido);
  if(reserva.status==='CONFLITO')return json({sucesso:false,mensagem:'Chave já usada com dados diferentes.'},409);
  if(!['RESERVADA','ABERTA'].includes(reserva.status))return json({sucesso:false,mensagem:'Solicitação já concluída ou indisponível.'},409);
  // Não existe envio externo neste fluxo. CAS impede duas aberturas da mesma chave.
  await env.HML_DB.prepare("UPDATE qr_requests SET state='ABERTA',ticket_id=?,updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND state='RESERVADA'").bind('SIM-'+pedido.idempotency_key,pedido.idempotency_key).run();
  const emitted=await linksConclusao(new Request('https://hml.invalid/hml/links/emitir',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:pedido.idempotency_key})}),env);
  const link=await emitted.json();if(!emitted.ok)return json(link,emitted.status);
  return json({sucesso:true,modo:'SIMULACAO',novo:reserva.created,location_id:pedido.location_id,ticket_simulado:'SIM-'+pedido.idempotency_key,link_conclusao:link.url,expira_em:link.expira_em},reserva.created?201:200);
 }catch{return json({sucesso:false,mensagem:'Falha na simulação. Reenvie com a mesma chave.'},503);}
}
