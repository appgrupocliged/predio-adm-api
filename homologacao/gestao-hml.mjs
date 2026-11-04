// Administração HML: listagem sintética resumida, sem dados pessoais e protegida por token.
import {tokenValido} from './reserva-hml.mjs';
import {qrcode} from './vendor/qrcode.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'
}});
export async function gestaoHml(request,env={}){
  if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
  if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)
    return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))
    return json({sucesso:false,mensagem:'Não autorizado.'},401);
  const path=new URL(request.url).pathname;
  if(path==='/hml/gestao/qr-fixos'){
    const locais=[
      ['B.01','Recepção consultas · comum 1'],
      ['B.02','Recepção consultas · comum 2'],
      ['B.03','Recepção exames · comum'],
      ['B.04','Recepção exames · acessível'],
      ['B.05','Sala RPA'],['B.06','2º piso'],
      ['B.07','Consultório 2'],['B.08','Consultório 4'],
      ['B.09','Sala exames 2']
    ];
    return json({sucesso:true,ambiente:'homologacao',tipo:'QR_PERMANENTE',
      locais:locais.map(([code,label])=>{
        const url='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev/hml/clinica/solicitar?unidade=CLI-MCE&local='+code;
        const qr=qrcode(0,'M');qr.addData(url);qr.make();
        return {code,label,url,svg:qr.createSvgTag({cellSize:5,margin:5,scalable:true})};
      })
    });
  }
  if(path==='/hml/gestao/qr'){
    try{
      const raw=await request.text();
      if(raw.length>2048)return json({sucesso:false,mensagem:'Link inválido.'},400);
      const b=JSON.parse(raw),url=new URL(b?.url);
      const fragment=new URLSearchParams(url.hash.slice(1));
      if(url.origin!=='https://cliged-qr-hml-isolado.appgrupocliged.workers.dev'||
         url.pathname!=='/hml/solicitante'||url.searchParams.get('unidade')!=='CLI-MCE'||
         !/^B\.0[1-9]$/.test(url.searchParams.get('local')||'')||
         !/^[-_A-Za-z0-9]{43}$/.test(fragment.get('sessao')||''))
        return json({sucesso:false,mensagem:'Link QR não pertence à homologação da clínica.'},400);
      const qr=qrcode(0,'M');qr.addData(url.toString());qr.make();
      return json({sucesso:true,svg:qr.createSvgTag({cellSize:5,margin:5,scalable:true})});
    }catch{return json({sucesso:false,mensagem:'Não foi possível gerar o QR.'},400);}
  }
  if(path!=='/hml/gestao/listar')return json({sucesso:false,mensagem:'Rota indisponível.'},404);
  try{
    const result=await env.HML_DB.prepare(
      "SELECT r.idempotency_key,r.unit_code,r.local_code,r.location_id,r.items_json,r.state,r.created_at FROM qr_requests r WHERE r.unit_code='CLI-MCE' AND r.ticket_id LIKE 'SIM-%' ORDER BY r.created_at DESC,r.rowid DESC LIMIT 60"
    ).all();
    return json({sucesso:true,ambiente:'homologacao',modo:'SIMULACAO',
      chamados:(result.results||[]).map(row=>({
        idempotency_key:row.idempotency_key,local:row.location_id,
        itens:JSON.parse(row.items_json),estado:row.state,criado_em:row.created_at
      }))
    });
  }catch{return json({sucesso:false,mensagem:'Não foi possível consultar os registros simulados.'},503);}
}
