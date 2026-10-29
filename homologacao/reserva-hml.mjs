// HML somente: solicitações simuladas persistidas no D1.
// Trava de acesso: requer token de teste no servidor, não inserido no frontend.
// Não contém integrações TomTicket, Google Chat ou encerramento de chamados.
import catalogo from "./catalogo-unidades.json" with {type:"json"};
import {prepararSolicitacao} from "./operacao-core.mjs";
import {reservar} from "./persistencia-d1.mjs";

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
export async function tokenValido(recebido,esperado){
  if(typeof esperado!=="string" || esperado.length<32 || typeof recebido!=="string")return false;
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(recebido)),crypto.subtle.digest("SHA-256",encoder.encode(esperado))]);
  const u=new Uint8Array(a),v=new Uint8Array(b);let difference=0;
  for(let i=0;i<u.length;i++)difference|=u[i]^v[i];
  return difference===0;
}
export async function reservarSimulacao(request,env={}){
  if(request.method!=="POST")return json({sucesso:false,mensagem:"Método não permitido."},405);
  if(!env.HML_DB?.prepare || !env.HML_WRITE_TOKEN)return json({sucesso:false,mensagem:"Homologação não habilitada."},503);
  const header=request.headers.get("Authorization")||"";
  if(!header.startsWith("Bearer ") || !(await tokenValido(header.slice(7),env.HML_WRITE_TOKEN)))
    return json({sucesso:false,mensagem:"Não autorizado."},401);
  let body;
  try{
    if(Number(request.headers.get("content-length")||0)>4096) return json({sucesso:false,mensagem:"Corpo muito grande."},413);
    const raw=await request.text();
    if(raw.length>4096)return json({sucesso:false,mensagem:"Corpo muito grande."},413);
    body=JSON.parse(raw);
    const p=await prepararSolicitacao(catalogo,body);
    const result=await reservar(env.HML_DB,p);
    if(result.status==="CONFLITO")return json({sucesso:false,mensagem:"Chave já usada com dados diferentes."},409);
    return json({sucesso:true,ambiente:"homologacao",modo:"SIMULACAO",location_id:p.location_id,
      estado:result.status,novo:result.created===true},result.http);
  }catch(e){
    // Não vazar SQL, stack, chaves ou payloads na resposta.
    if(["PAYLOAD_INVALIDO","CHAVE_INVALIDA","SERVICOS_INVALIDOS"].includes(e.codigo) ||
      /local|unidade|código|inválido|não cadastrada/i.test(e.message))
      return json({sucesso:false,mensagem:"Dados da simulação inválidos."},400);
    return json({sucesso:false,mensagem:"Falha na reserva de homologação."},503);
  }
}
