import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pilotoExternoHml} from './piloto-externo-hml.mjs';

let calls=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>{calls++;throw Error('External network must stay closed');};
try{
 const env={CLIGED_AMBIENTE:'homologacao',HML_DB:{prepare(){throw Error('Unexpected database call');}},HML_WRITE_TOKEN:'h'.repeat(48)};
 const req=(token='h'.repeat(48),confirmacao='CONFIRMO UM CHAMADO REAL DE TESTE')=>new Request('https://hml.invalid/hml/integracao/piloto',{
  method:'POST',headers:{Authorization:'Bearer '+token},
  body:JSON.stringify({idempotency_key:'00000000-0000-4000-8000-000000000091',confirmacao})
 });
 const unauthorized=await pilotoExternoHml(req('wrong'),env);
 assert.equal(unauthorized.status,401);
 const invalid=await pilotoExternoHml(req('h'.repeat(48),'INCORRETO'),env);
 assert.equal(invalid.status,400);
 const disabled=await pilotoExternoHml(req(),env);
 assert.equal(disabled.status,423);
 assert.equal(calls,0);
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE qr_requests(idempotency_key TEXT PRIMARY KEY)');
  db.exec(readFileSync(new URL('./migrations/006_hml_external_pilot.sql',import.meta.url),'utf8'));
  db.prepare("INSERT INTO qr_requests(idempotency_key) VALUES (?)").run('A');
  db.prepare("INSERT INTO qr_requests(idempotency_key) VALUES (?)").run('B');
  db.prepare("INSERT INTO hml_external_pilots(request_key,status) VALUES (?,'RESERVADO')").run('A');
  assert.throws(()=>db.prepare("INSERT INTO hml_external_pilots(request_key,status) VALUES (?,'RESERVADO')").run('B'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hml_external_pilots').get().n,1);
 }finally{db.close();}
 console.log('PASS: piloto externo bloqueado sem habilitação e credenciais próprias');
}finally{globalThis.fetch=oldFetch;}
