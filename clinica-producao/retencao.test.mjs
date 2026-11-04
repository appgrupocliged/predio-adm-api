import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {limparHistoricoClinica} from './retencao.mjs';
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('./010_retencao_segura.sql',import.meta.url),'utf8'));
const prep=(sql,params)=>({sql,params});
const hmlDb={
 prepare(sql){return{bind(...params){return prep(sql,params)}}},
 async batch(statements){
  db.exec('BEGIN');
  try{const results=statements.map(s=>({meta:{changes:Number(db.prepare(s.sql).run(...s.params).changes)}}));
   db.exec('COMMIT');return results;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
};
const realPrepare=hmlDb.prepare;
hmlDb.prepare=function(sql){return{
 bind(...params){return {
  sql,params,
  async all(){return {results:db.prepare(sql).all(...params)}}
 }},
}};
function put(key,state,chat,updated,services=['Papel higiênico']){
 const id='00000000-0000-4000-8000-'+key.toString().padStart(12,'0');
 db.prepare('INSERT INTO qr_requests(idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state,ticket_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
 .run(id,'f'.repeat(64),'CLI-MCE','B.01','CLI-MCE:B.01',JSON.stringify(services),state,'TICKET-'+key,updated,updated);
 db.prepare('INSERT INTO hml_clinic_live_dispatch(request_key,ticket_id,stage) VALUES(?,?,?)').run(id,'TICKET-'+key,'ATIVO');
 db.prepare('INSERT INTO hml_real_completion_dispatch(request_key,ticket_id,actor,state) VALUES(?,?,?,?)').run(id,'TICKET-'+key,'Teste',chat);
 db.prepare('INSERT INTO hml_real_completion_links(token_hash,request_key,expires_at) VALUES(?,?,?)').run('hash-'+key,id,9999999999);
 return id;
}
const old='2026-05-01 10:00:00',recent='2026-11-01 10:00:00';
const completed=put(1,'CONCLUIDA','CHAT_ENVIADO',old,['Papel higiênico','limpeza']);
const open=put(2,'ABERTA','CHAT_ENVIADO',old);
const uncertain=put(3,'CONCLUIDA','CHAT_INCERTO',old);
const newDone=put(4,'CONCLUIDA','CHAT_ENVIADO',recent);
const env={CLIGED_AMBIENTE:'clinica-producao',HML_DB:hmlDb,CLINIC_RETENTION_DAYS:'90',CLINIC_RETENTION_BATCH_SIZE:'10'};
assert.equal((await limparHistoricoClinica(env,new Date('2026-11-04T12:00:00Z'))).apagados,0);
env.CLINIC_RETENTION_ENABLED='SIM_90_DIAS';
const result=await limparHistoricoClinica(env,new Date('2026-11-04T12:00:00Z'));
assert.equal(result.apagados,1);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qr_requests').get().n,3);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qr_requests WHERE idempotency_key=?').get(completed).n,0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qr_requests WHERE idempotency_key=?').get(open).n,1);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qr_requests WHERE idempotency_key=?').get(uncertain).n,1);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qr_requests WHERE idempotency_key=?').get(newDone).n,1);
assert.equal(db.prepare('SELECT SUM(completed_count) n FROM clinic_monthly_summary').get().n,2);
assert.equal((await limparHistoricoClinica(env,new Date('2026-11-04T12:00:00Z'))).apagados,0);
assert.equal(db.prepare('SELECT SUM(completed_count) n FROM clinic_monthly_summary').get().n,2);
db.close();
console.log('PASS: retenção inicialmente desligada, limpeza 90 dias apenas encerrados/Chat enviado, resumo mensal idempotente');
