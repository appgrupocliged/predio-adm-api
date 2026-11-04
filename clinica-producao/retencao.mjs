// Somente Worker de producao da Clinica. Desativado por padrao.
// D1 .batch aplica os statements do lote numa transacao.
// O ledger de chamados incertos/abertos permanece intacto.
const parseDays=(v,def)=>{const n=Number(v);return Number.isInteger(n)&&n>=90&&n<=3650?n:def;};
const parseBatch=v=>{const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=25?n:10;};
export async function limparHistoricoClinica(env={},now=new Date()){
 if(env.CLIGED_AMBIENTE!=='clinica-producao'||env.CLINIC_RETENTION_ENABLED!=='SIM_90_DIAS'||
  !env.HML_DB?.prepare||!env.HML_DB?.batch)
  return {status:'DESATIVADA',apagados:0};
 const days=parseDays(env.CLINIC_RETENTION_DAYS,90);
 const limit=parseBatch(env.CLINIC_RETENTION_BATCH_SIZE);
 const cutoff=new Date(now.getTime()-days*86400000).toISOString().slice(0,19).replace('T',' ');
 const db=env.HML_DB;
 const candidates=await db.prepare(`
 SELECT r.idempotency_key
 FROM qr_requests r
 JOIN hml_real_completion_dispatch c ON c.request_key=r.idempotency_key AND c.state='CHAT_ENVIADO'
 JOIN hml_clinic_live_dispatch a ON a.request_key=r.idempotency_key AND a.stage='ATIVO'
 WHERE r.unit_code='CLI-MCE' AND r.state='CONCLUIDA' AND r.updated_at < ?
 ORDER BY r.updated_at ASC LIMIT ?`).bind(cutoff,limit).all();
 let total=0;
 for(const {idempotency_key:key} of (candidates.results||[])){
  // Para cada registro, uma transacao: sumarizar, excluir filhos, excluir principal.
  // O DELETE final sempre repete a condicao de elegibilidade.
  const elig=`r.idempotency_key=? AND r.unit_code='CLI-MCE' AND r.state='CONCLUIDA' AND r.updated_at < ?
   AND EXISTS(SELECT 1 FROM hml_real_completion_dispatch c WHERE c.request_key=r.idempotency_key AND c.state='CHAT_ENVIADO')
   AND EXISTS(SELECT 1 FROM hml_clinic_live_dispatch a WHERE a.request_key=r.idempotency_key AND a.stage='ATIVO')`;
  const stmts=[
   db.prepare(`INSERT INTO clinic_monthly_summary(month,unit_code,location_id,service,completed_count)
     SELECT substr(r.created_at,1,7),r.unit_code,r.location_id,j.value,1
     FROM qr_requests r,json_each(r.items_json) j WHERE ${elig}
     ON CONFLICT(month,location_id,service)
     DO UPDATE SET completed_count=completed_count+1,last_archived_at=CURRENT_TIMESTAMP`).bind(key,cutoff),
   db.prepare('DELETE FROM qr_events WHERE idempotency_key=?').bind(key),
   db.prepare('DELETE FROM hml_real_completion_links WHERE request_key=?').bind(key),
   db.prepare('DELETE FROM hml_real_completion_dispatch WHERE request_key=?').bind(key),
   db.prepare('DELETE FROM hml_clinic_live_dispatch WHERE request_key=?').bind(key),
   db.prepare(`DELETE FROM qr_requests WHERE idempotency_key=? AND unit_code='CLI-MCE'
      AND state='CONCLUIDA' AND updated_at < ?`).bind(key,cutoff)
  ];
  const result=await db.batch(stmts);
  const deleted=result[result.length-1]?.meta?.changes||0;
  if(deleted!==1)throw Error('Retencao: transacao sem exclusao final, verificar auditoria');
  total+=deleted;
 }
 return {status:'EXECUTADA',apagados:total,limite_lote:limit,dias:days};
}
