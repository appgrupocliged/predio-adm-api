// Novo Worker EXCLUSIVO da Clinica CLIGED Macae, sem importar o worker.js do Predio ADM.
// Manter a integracao desligada ate o binding D1 dedicado e secrets serem configurados.
import catalogo from '../homologacao/catalogo-unidades.json' with {type:'json'};
import {htmlClinicaReal} from '../homologacao/solicitante-real-page-hml.mjs';
import {htmlAtendimentoReal} from '../homologacao/atendimento-real-page-hml.mjs';
import {solicitarClinicaReal} from '../homologacao/abertura-real-clinica-hml.mjs';
import {conclusaoRealClinica} from '../homologacao/conclusao-real-clinica-hml.mjs';
import {qrcode} from '../homologacao/vendor/qrcode.js';
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'
}});
const htmlHeaders={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src https://appgrupocliged.github.io; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
 'X-Content-Type-Options':'nosniff'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE='https://cliged-qr-clinica.appgrupocliged.workers.dev';
const places=catalogo.units['CLI-MCE'].locations;
const ready=e=>e.CLIGED_AMBIENTE==='clinica-producao'&&e.HML_DB?.prepare;
const status=async(url,env)=>{
 const key=url.searchParams.get('request_key')||'';
 if(!uuid.test(key))return json({sucesso:false,mensagem:'Identificador invalido.'},400);
 try{
  const row=await env.HML_DB.prepare(
   "SELECT state FROM qr_requests WHERE idempotency_key=? AND unit_code='CLI-MCE'"
  ).bind(key.toLowerCase()).first();
  if(!row)return json({sucesso:false,mensagem:'Solicitacao nao localizada.'},404);
  return json({sucesso:true,estado:row.state==='CONCLUIDA'?'CONCLUIDA':row.state==='ABERTA'?'ABERTA':'PROCESSANDO'});
 }catch{return json({sucesso:false,mensagem:'Consulta temporariamente indisponivel.'},503);}
};
const qrPage=String.raw`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CLIGED | QR Codes Clínica</title><style>*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f5f5;font:15px system-ui}main{max-width:1200px;margin:auto;padding:24px}
h1{color:#f1e7a8}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{background:white;border:2px solid #111;color:#111;padding:17px;text-align:center;break-inside:avoid;border-radius:8px}
.card h2{margin:0;font-size:24px}.card p{min-height:45px;color:#444;font-size:13px}.card svg{max-width:240px;width:100%;height:auto}
button{padding:12px 18px;background:#f1e7a8;border:0;border-radius:8px;font-weight:700;cursor:pointer}
@media(max-width:700px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:450px){.grid{grid-template-columns:1fr}}
@media print{body{background:white}h1,button,.hint{display:none}.grid{grid-template-columns:repeat(3,1fr);gap:10px}.card{border-color:#000}}
</style></head><body><main><h1>Clínica CLIGED Macaé — 9 QR Codes</h1>
<p class="hint">Use apenas após a validação da implantação do Worker de produção.</p><button onclick="window.print()">Imprimir QR Codes</button>
<div id="grid" class="grid"></div></main><script>
(async()=>{
 const res=await fetch('/qr-codes.json',{cache:'no-store'});if(!res.ok)return;
 const data=await res.json(),grid=document.getElementById('grid');
 for(const item of data.locais){
  const c=document.createElement('article');c.className='card';
  const h=document.createElement('h2');h.textContent='CLIGED · '+item.codigo;
  const p=document.createElement('p');p.textContent=item.nome;
  const svg=new DOMParser().parseFromString(item.svg,'image/svg+xml').documentElement;
  const footer=document.createElement('small');footer.textContent='Solicite limpeza ou reposição pelo QR Code';
  c.append(h,p,document.importNode(svg,true),footer);grid.append(c);
 }
})();
</script></body></html>`;
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(!ready(env))return json({sucesso:false,mensagem:'Worker da Clinica nao configurado.'},503);
  if(request.method==='GET'&&path==='/')return json({status:'online',sistema:'CLIGED QR Clinica Macae',locais:9});
  if(request.method==='GET'&&path==='/catalogo'){
   return json({sucesso:true,unidades:[{codigo:'CLI-MCE',nome:'Clínica CLIGED Macaé',
    locais:Object.entries(places).map(([codigo,nome])=>({codigo,nome}))}]});
  }
  if(request.method==='GET'&&(path==='/clinica'||path==='/hml/clinica/solicitar'))
   return new Response(htmlClinicaReal,{headers:htmlHeaders});
  if(request.method==='GET'&&(path==='/concluir'||path==='/hml/atendimento-real'))
   return new Response(htmlAtendimentoReal.replace(/<div role="status"[^>]*>[^<]*<\/div>/,''),{headers:htmlHeaders});
  if(request.method==='POST'&&path==='/hml/clinica/solicitar')
   return solicitarClinicaReal(request,env);
  if(request.method==='GET'&&path==='/hml/clinica/status')
   return status(url,env);
  if(request.method==='POST'&&['/hml/real/links/concluir','/hml/real/links/consultar'].includes(path))
   return conclusaoRealClinica(request,env);
  if(request.method==='GET'&&path==='/qr-codes')
   return new Response(qrPage,{headers:htmlHeaders});
  if(request.method==='GET'&&path==='/qr-codes.json'){
   return json({sucesso:true,locais:Object.entries(places).map(([codigo,nome])=>{
    const link=BASE+'/clinica?unidade=CLI-MCE&local='+codigo;
    const q=qrcode(0,'M');q.addData(link);q.make();
    return {codigo,nome,url:link,svg:q.createSvgTag({cellSize:5,margin:5,scalable:true})};
   })});
  }
  return json({sucesso:false,mensagem:'Rota nao encontrada.'},404);
 }
};
