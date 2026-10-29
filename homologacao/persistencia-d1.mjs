// Persistência HML: exige binding D1 HML_DB separado e migração 001.
// Este módulo não envia solicitações ao TomTicket.
export async function reservar(db, pedido) {
  if (!db || typeof db.prepare !== "function") throw Error("HML_DB não configurado");
  const chave=pedido.idempotency_key;
  // A UNIQUE PRIMARY KEY garante uma reserva única em chamadas concorrentes.
  const insert = await db.prepare(
    "INSERT OR IGNORE INTO qr_requests (idempotency_key, fingerprint, unit_code, local_code, location_id, items_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(chave,pedido.fingerprint,pedido.unit_code,pedido.local_code,pedido.location_id,JSON.stringify(pedido.servicos)).run();
  const created = insert?.meta?.changes === 1;
  const row=await db.prepare(
    "SELECT idempotency_key, fingerprint, location_id, unit_code, local_code, state, ticket_id FROM qr_requests WHERE idempotency_key = ?"
  ).bind(chave).first();
  if(!row)throw Error("Reserva não encontrada após gravação");
  if(row.fingerprint!==pedido.fingerprint || row.location_id!==pedido.location_id)
    return {status:"CONFLITO",http:409};
  return {status:row.state,ticket_id:row.ticket_id??null,created,http:row.state==="ABERTA"?200:202};
}
export async function transicionar(db,chave,estadoAtual,novoEstado,{ticketId=null,actor=null}={}) {
  if (!db || typeof db.prepare!=="function")throw Error("HML_DB não configurado");
  const permitidas={
    RESERVADA:["ENVIO_INICIADO"],
    ENVIO_INICIADO:["ABERTA","ENVIO_INCERTO"],
    ENVIO_INCERTO:["ABERTA"],
    ABERTA:["CONCLUSAO_INICIADA"],
    CONCLUSAO_INICIADA:["CONCLUIDA","CONCLUSAO_INCERTA"],
    CONCLUSAO_INCERTA:["CONCLUIDA"]
  };
  if(!permitidas[estadoAtual]?.includes(novoEstado))throw Error("Transição não permitida");
  // UPDATE condicional impede que duas instâncias reivindiquem a mesma operação.
  const r=await db.prepare(
    "UPDATE qr_requests SET state = ?, ticket_id = COALESCE(?,ticket_id), actor = COALESCE(?,actor), updated_at=CURRENT_TIMESTAMP WHERE idempotency_key = ? AND state = ?"
  ).bind(novoEstado,ticketId,actor,chave,estadoAtual).run();
  return r.meta?.changes === 1;
}
// ENVIO_INCERTO e CONCLUSAO_INCERTA exigem reconciliação antes de retry.
// Não transicionar de volta a RESERVADA: isso poderia duplicar ticket real.
