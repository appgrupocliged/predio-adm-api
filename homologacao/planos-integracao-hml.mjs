// Adaptadores PUROS de integração: geram payloads, mas NÃO fazem fetch.
// Fluxo real só pode ser habilitado após D1 isolado, JWT Access validado,
// reconciliação de falhas e aprovação explícita. Não importar em worker.js.
function obrigatorio(valor, campo) {
  if (typeof valor !== "string" || !valor.trim()) throw Error(campo + " obrigatório");
  return valor.trim();
}
function urlConclusao(base, pedido, ticketId) {
  const url=new URL(obrigatorio(base,"concluir_url"));
  if(url.protocol!=="https:")throw Error("URL de conclusão exige HTTPS");
  // Na homologação o destino jamais pode ser o frontend da produção.
  if(url.hostname==="appgrupocliged.github.io" && url.pathname==="/predio-adm/concluir.html")
    throw Error("Frontend de produção proibido no adaptador HML");
  url.searchParams.set("id",ticketId);
  url.searchParams.set("unidade",pedido.unit_code);
  url.searchParams.set("local",pedido.local_code);
  return url.toString();
}
// Reproduz contratos do Worker ativo sem credenciais, com unidade explícita.
export function prepararPlanoIntegracao(pedido,config) {
  if(!pedido || !config || !pedido.location_id ||
     pedido.location_id!==pedido.unit_code+":"+pedido.local_code ||
     !pedido.assunto || !pedido.mensagem)throw Error("Solicitação não validada");
  const customer=obrigatorio(config.customer_id,"customer_id");
  const department=obrigatorio(config.department_id,"department_id");
  const operator=obrigatorio(config.operator_id,"operator_id");
  const ticket=obrigatorio(config.ticket_id_simulado,"ticket_id_simulado");
  if(!ticket.startsWith("SIM-"))throw Error("Somente ticket simulado");
  const concluir=urlConclusao(config.concluir_url,pedido,ticket);
  const criar=new URLSearchParams({
    customer_id:customer,customer_id_type:"E",department_id:department,
    category_id:pedido.categoria,subject:pedido.assunto,
    message:pedido.mensagem,priority:pedido.prioridade
  });
  const transferir={ticket_id:ticket,operator_id:operator};
  const link=new URLSearchParams({
    ticket_id:ticket,message:"🔗 CONCLUIR SOLICITAÇÃO:\n\n"+concluir
  });
  const notificacao={text:"🚨 NOVA SOLICITAÇÃO\n\n"+
    "🏥 Unidade: "+pedido.unit_name+" ("+pedido.unit_code+")\n"+
    "📍 Local: "+pedido.local_code+" — "+pedido.local_name+"\n"+
    pedido.servicos.map(x=>"• "+x).join("\n")+
    "\n\n🔗 Concluir solicitação:\n"+concluir};
  return Object.freeze({
    modo:"SIMULACAO_SEM_REDE",
    location_id:pedido.location_id,
    passos:[
      {nome:"criar",rota:"/v2.0/ticket/new",tipo:"FORM",body:criar.toString()},
      {nome:"vincular_gleice",rota:"/v2.0/ticket/transfer",tipo:"FORM_DATA",body:transferir},
      {nome:"inserir_link",rota:"/v2.0/ticket/reply/customer",tipo:"FORM",body:link.toString()},
      {nome:"notificar_chat",rota:"GOOGLE_CHAT_WEBHOOK",tipo:"JSON",body:notificacao}
    ]
  });
}
// Os objetos acima NÃO contêm URL da API TomTicket, tokens, webhooks ou métodos de envio.
