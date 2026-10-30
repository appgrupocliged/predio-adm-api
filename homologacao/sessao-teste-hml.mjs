import catalogo from './catalogo-unidades.json' with {type:'json'};
import {prepararSolicitacao} from './operacao-core.mjs';
import {tokenValido} from './reserva-hml.mjs';
import {simularCompleto} from './simulacao-completa-hml.mjs';
const BASE='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev';
const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
async function hash(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function sessaoTeste(request,env={}){
 if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
 if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)return json({sucesso:false,mensagem:'Teste indisponível.'},503);
 const path=new URL(request.url).pathname,now=Math.floor(Date.now()/1000);
 if(path==='/hml/testes/emitir'){
  const a=request.headers.get('Authorization')||'';
  if(!a.startsWith('Bearer ')||!await tokenValido(a.slice(7),env.HML_WRITE_TOKEN))return json({sucesso:false,mensagem:'Não autorizado.'},401);
  try{const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   await env.HML_DB.prepare('INSERT INTO hml_test_sessions(token_hash,expires_at,max_requests) VALUES(?,?,?)').bind(await hash(token),now+86400,20).run();
   return json({sucesso:true,url:BASE+'/hml/solicitante#sessao='+token,expira_em:new Date((now+86400)*1000).toISOString(),limite:20},201);
  }catch{return json({sucesso:false,mensagem:'Falha ao preparar acesso de teste.'},503);}
 }
 let b;
 try{const raw=await request.text();if(raw.length>4096)throw Error();b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(b.token))throw Error();}
 catch{return json({sucesso:false,mensagem:'Acesso de teste inválido.'},400);}
 try{
  const digest=await hash(b.token);
  const session=await env.HML_DB.prepare('SELECT expires_at,max_requests FROM hml_test_sessions WHERE token_hash=? AND expires_at>?').bind(digest,now).first();
  if(!session)return json({sucesso:false,mensagem:'O acesso de teste expirou ou é inválido.'},401);
  if(path==='/hml/testes/sessao'){
   const count=await env.HML_DB.prepare('SELECT COUNT(*) AS n FROM hml_test_requests WHERE session_hash=?').bind(digest).first();
   return json({sucesso:true,restantes:Math.max(0,session.max_requests-count.n),expira_em:new Date(session.expires_at*1000).toISOString()});
  }
  if(path!=='/hml/testes/solicitar')return json({sucesso:false},404);
  let p;try{p=await prepararSolicitacao(catalogo,b.pedido);}catch{return json({sucesso:false,mensagem:'Unidade, local ou serviços inválidos.'},400);}
  // A quota e a vinculação da chave são decididas no mesmo INSERT, no D1.
  // Reenvios da mesma chave não consomem outra posição e não tomam pedidos alheios.
  await env.HML_DB.prepare('INSERT OR IGNORE INTO hml_test_requests(idempotency_key,session_hash,fingerprint) SELECT ?,s.token_hash,? FROM hml_test_sessions s WHERE s.token_hash=? AND s.expires_at>? AND (SELECT COUNT(*) FROM hml_test_requests WHERE session_hash=s.token_hash)<s.max_requests AND NOT EXISTS(SELECT 1 FROM qr_requests WHERE idempotency_key=?)').bind(p.idempotency_key,p.fingerprint,digest,now,p.idempotency_key).run();
  const grant=await env.HML_DB.prepare('SELECT session_hash,fingerprint FROM hml_test_requests WHERE idempotency_key=?').bind(p.idempotency_key).first();
  if(!grant)return json({sucesso:false,mensagem:'Limite de teste atingido ou chave indisponível.'},429);
  if(grant.session_hash!==digest||grant.fingerprint!==p.fingerprint)return json({sucesso:false,mensagem:'Chave já usada com outros dados.'},409);
  return simularCompleto(new Request(BASE+'/hml/simular',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.HML_WRITE_TOKEN},body:JSON.stringify(b.pedido)}),env);
 }catch{return json({sucesso:false,mensagem:'Não foi possível gravar. Tente reenviar a mesma solicitação.'},503);}
}
