// Fluxo exclusivo de simulação: nenhum envio a TomTicket ou Google Chat.
import {tokenValido} from './reserva-hml.mjs';
const BASE='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function body(request){const raw=await request.text();if(raw.length>2048)throw Error('invalid');const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw Error('invalid');return b;}
export async function linksConclusao(request,env={}){
 if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
 if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare)return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
 const path=new URL(request.url).pathname;
 try{
  if(path==='/hml/links/emitir'){
   const auth=request.headers.get('Authorization')||'';
   if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))return json({sucesso:false,mensagem:'Não autorizado.'},401);
   const b=await body(request);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.idempotency_key||''))return json({sucesso:false,mensagem:'Identificador inválido.'},400);
   const row=await env.HML_DB.prepare('SELECT state,ticket_id FROM qr_requests WHERE idempotency_key=?').bind(b.idempotency_key.toLowerCase()).first();
   if(!row||row.state!=='ABERTA'||!row.ticket_id?.startsWith('SIM-'))return json({sucesso:false,mensagem:'Solicitação simulada não disponível.'},409);
   const random=crypto.getRandomValues(new Uint8Array(32));
   const token=btoa(String.fromCharCode(...random)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const expires=Math.floor(Date.now()/1000)+48*3600;
   await env.HML_DB.prepare('INSERT INTO hml_completion_links (token_hash,idempotency_key,expires_at) VALUES (?,?,?)').bind(await hash(token),b.idempotency_key.toLowerCase(),expires).run();
   return json({sucesso:true,modo:'SIMULACAO',url:BASE+'/hml/atendimento#chave='+token,expira_em:new Date(expires*1000).toISOString()},201);
  }
  const b=await body(request);
  // Identidade e unidade vêm do banco; não aceitar substituições no formulário.
  const fields=path==='/hml/links/concluir'?['token','nome']:['token'];
  if(Object.keys(b).some(k=>!fields.includes(k))||!/^[-_A-Za-z0-9]{43}$/.test(b.token||''))return json({sucesso:false,mensagem:'Link ou dados inválidos.'},400);
  const digest=await hash(b.token),now=Math.floor(Date.now()/1000);
  const row=await env.HML_DB.prepare("SELECT r.idempotency_key,r.unit_code,r.local_code,r.location_id,r.items_json,r.state,r.ticket_id FROM hml_completion_links l JOIN qr_requests r ON r.idempotency_key=l.idempotency_key WHERE l.token_hash=? AND l.expires_at>? AND r.ticket_id LIKE 'SIM-%'").bind(digest,now).first();
  if(!row)return json({sucesso:false,mensagem:'Link inválido ou expirado.'},404);
  if(path==='/hml/links/consultar')return json({sucesso:true,modo:'SIMULACAO',unidade:row.unit_code,local:row.local_code,location_id:row.location_id,itens:JSON.parse(row.items_json),estado:row.state});
  if(path!=='/hml/links/concluir')return json({sucesso:false},404);
  const nome=typeof b.nome==='string'?b.nome.trim():'';
  if(nome.length<2||nome.length>100||/[\x00-\x1f\x7f]/.test(nome))return json({sucesso:false,mensagem:'Informe um nome entre 2 e 100 caracteres.'},400);
  // Não há serviço externo nesta simulação: conclusão e evento são atômicos.
  const result=await env.HML_DB.prepare("UPDATE qr_requests SET state='CONCLUIDA',actor=?,updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND state='ABERTA' AND ticket_id LIKE 'SIM-%' AND EXISTS (SELECT 1 FROM hml_completion_links WHERE token_hash=? AND idempotency_key=qr_requests.idempotency_key AND expires_at>?)").bind('NOME_INFORMADO:'+nome,row.idempotency_key,digest,now).run();
  if(!(result.meta?.changes>0))return json({sucesso:false,mensagem:'Solicitação já concluída ou indisponível.'},409);
  return json({sucesso:true,modo:'SIMULACAO',estado:'CONCLUIDA',mensagem:'Conclusão registrada somente na homologação.'});
 }catch{return json({sucesso:false,mensagem:'Não foi possível processar a solicitação.'},400);}
}
