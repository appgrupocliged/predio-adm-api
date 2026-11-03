// Administração HML: listagem sintética resumida, sem dados pessoais e protegida por token.
import {tokenValido} from './reserva-hml.mjs';
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
  if(new URL(request.url).pathname!=='/hml/gestao/listar')return json({sucesso:false,mensagem:'Rota indisponível.'},404);
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
