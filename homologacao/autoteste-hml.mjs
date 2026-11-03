// Teste ponta a ponta EXCLUSIVO de homologação. Não usa TomTicket/Google Chat.
import {tokenValido} from './reserva-hml.mjs';
import {simularCompleto} from './simulacao-completa-hml.mjs';
import {auditarHml} from './auditoria-hml.mjs';
import {linksConclusao} from './links-conclusao-hml.mjs';
import {htmlAutoteste} from './autoteste-page-hml.mjs';

const BASE='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev';
const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'
}});
const TABLES=['qr_requests','qr_events','hml_completion_links','hml_test_sessions','hml_test_requests','hml_test_qr_locations'];
const TRIGGERS=['qr_requests_audit_insert','qr_requests_audit_state'];
const req=(path,payload,auth)=>new Request(BASE+path,{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify(payload)
});
const run=async(fn)=>{const response=await fn();return {status:response.status,data:await response.json()};};
function fail(stage,msg){const e=new Error(msg);e.stage=stage;throw e;}

export async function autotesteHml(request,env={}){
  if(request.method==='GET')return new Response(htmlAutoteste,{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }});
  if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
  if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)
    return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))
    return json({sucesso:false,mensagem:'Não autorizado.'},401);
  let stage='estrutura';
  try{
    const schema=await env.HML_DB.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','trigger')").all();
    const found=new Set((schema.results||[]).map(x=>x.type+':'+x.name));
    if(!TABLES.every(n=>found.has('table:'+n))||!TRIGGERS.every(n=>found.has('trigger:'+n)))
      return json({sucesso:false,etapa:'estrutura',mensagem:'Migrações de homologação incompletas.'},503);
    const key=crypto.randomUUID();
    const pedido={idempotency_key:key,unit_code:'CLI-MCE',local_code:'B.09',items:['Papel toalha']};
    const etapas=[];

    stage='abertura';
    const first=await run(()=>simularCompleto(req('/hml/simular',pedido,auth),env));
    if(first.status!==201||first.data.novo!==true||!first.data.link_conclusao)
      fail(stage,'A abertura inicial não foi confirmada.');
    etapas.push('Abertura simulada no D1: APROVADA');

    stage='idempotencia';
    const second=await run(()=>simularCompleto(req('/hml/simular',pedido,auth),env,{emitirLink:false}));
    if(second.status!==200||second.data.novo!==false||second.data.estado!=='ABERTA')
      fail(stage,'Reenvio não foi reconhecido como repetição.');
    etapas.push('Reenvio sem duplicidade: APROVADO');

    stage='auditoria';
    const audit=await run(()=>auditarHml(req('/hml/auditar',{idempotency_key:key},auth),env));
    if(audit.status!==200||audit.data.estado!=='ABERTA'||audit.data.location_id!=='CLI-MCE:B.09')
      fail(stage,'A auditoria inicial não confirmou o local e o estado.');
    const counts=await env.HML_DB.prepare(
      'SELECT (SELECT COUNT(*) FROM qr_requests WHERE idempotency_key=?) AS registros, (SELECT COUNT(*) FROM qr_events WHERE idempotency_key=?) AS eventos'
    ).bind(key,key).first();
    if(counts.registros!==1||counts.eventos!==2)
      fail(stage,'A trilha inicial não corresponde a um único registro.');
    etapas.push('D1 com 1 registro e 2 eventos iniciais: APROVADO');

    stage='conclusao';
    const link=new URL(first.data.link_conclusao);
    const token=new URLSearchParams(link.hash.slice(1)).get('chave');
    if(link.origin!==BASE||link.pathname!=='/hml/atendimento'||!/^[-_A-Za-z0-9]{43}$/.test(token||''))
      fail(stage,'Link de conclusão inválido.');
    const concluir=()=>linksConclusao(new Request(BASE+'/hml/links/concluir',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,nome:'Teste automatico CLIGED HML'})
    }),env);
    const final=await run(concluir);
    if(final.status!==200||final.data.estado!=='CONCLUIDA')
      fail(stage,'A conclusão não foi confirmada.');
    const retry=await run(concluir);
    if(retry.status!==409)fail(stage,'Uma segunda conclusão foi aceita.');
    etapas.push('Conclusão única por link: APROVADA');

    stage='auditoria_final';
    const auditFinal=await run(()=>auditarHml(req('/hml/auditar',{idempotency_key:key},auth),env));
    const finalCounts=await env.HML_DB.prepare(
      'SELECT (SELECT COUNT(*) FROM qr_requests WHERE idempotency_key=? AND state=?) AS concluidas, (SELECT COUNT(*) FROM qr_events WHERE idempotency_key=?) AS eventos'
    ).bind(key,'CONCLUIDA',key).first();
    if(auditFinal.status!==200||auditFinal.data.estado!=='CONCLUIDA'||
       finalCounts.concluidas!==1||finalCounts.eventos!==3)
      fail(stage,'Os dados finais não correspondem ao histórico esperado.');
    etapas.push('Estado CONCLUIDA e 3 eventos: APROVADO');
    return json({sucesso:true,ambiente:'homologacao',modo:'SIMULACAO',resultado:'APROVADO',
      local:'CLI-MCE:B.09',teste_id:key,registros:1,eventos:3,etapas});
  }catch(e){
    return json({sucesso:false,ambiente:'homologacao',modo:'SIMULACAO',etapa:e.stage||stage,
      mensagem:e.stage?e.message:'Falha de execução. Consulte o estado da homologação antes de tentar novamente.'},503);
  }
}
