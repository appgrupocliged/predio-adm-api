// Consulta administrativa HML, autenticada pelo segredo do ambiente.
// Retorna apenas contagens e metadados de uma chave, nunca serviços/identidades.
import {tokenValido} from "./reserva-hml.mjs";
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}})}
export async function auditarHml(request,env={}){
 if(request.method!=="POST")return response({sucesso:false,mensagem:"Método não permitido."},405);
 if(!env.HML_DB?.prepare || !env.HML_WRITE_TOKEN)return response({sucesso:false,mensagem:"Homologação não habilitada."},503);
 const authorization=request.headers.get("Authorization")||"";
 if(!authorization.startsWith("Bearer ") || !(await tokenValido(authorization.slice(7),env.HML_WRITE_TOKEN)))
   return response({sucesso:false,mensagem:"Não autorizado."},401);
 let payload;
 try{
  const raw=await request.text();if(raw.length>512)throw Error("Dados inválidos");
  payload=JSON.parse(raw);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload?.idempotency_key))throw Error("Chave inválida");
 }catch{return response({sucesso:false,mensagem:"Identificador inválido."},400)}
 try{
  const row=await env.HML_DB.prepare("SELECT location_id, state, created_at, updated_at FROM qr_requests WHERE idempotency_key = ?").bind(payload.idempotency_key.toLowerCase()).first();
  if(!row)return response({sucesso:true,encontrado:false});
  return response({sucesso:true,encontrado:true,location_id:row.location_id,estado:row.state,criado_em:row.created_at,atualizado_em:row.updated_at});
 }catch{return response({sucesso:false,mensagem:"Erro na consulta HML."},503)}
}
