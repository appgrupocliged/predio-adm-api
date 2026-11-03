import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {encerrarPilotoHml} from './encerramento-piloto-hml.mjs';

const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE qr_requests(idempotency_key TEXT PRIMARY KEY)');
db.exec(readFileSync(new URL('./migrations/006_hml_external_pilot.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('./migrations/007_piloto_encerramento_real.sql',import.meta.url),'utf8'));
db.prepare('INSERT INTO qr_requests(idempotency_key) VALUES (?)').run('a');
db.prepare("INSERT INTO hml_external_pilots(request_key,status,ticket_id) VALUES (?,'NOTIFICADO',?)").run('a','TEST-1');
db.prepare("INSERT INTO hml_pilot_real_closure(request_key,ticket_id,state) VALUES (?,?,'INICIADA')").run('a','TEST-1');
assert.throws(()=>db.prepare("INSERT INTO hml_pilot_real_closure(request_key,ticket_id,state) VALUES (?,?,'INICIADA')").run('a','TEST-1'));
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hml_pilot_real_closure').get().n,1);
db.close();
const env={CLIGED_AMBIENTE:'homologacao',HML_DB:{prepare(){throw Error('never query on disabled');}},HML_WRITE_TOKEN:'x'.repeat(48)};
const request=(token='x'.repeat(48))=>new Request('https://hml.invalid/hml/integracao/encerrar-piloto',{
method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({
idempotency_key:'47dfa4cf-4fcc-4508-b14d-7001c7cb43c8',
confirmacao:'CONFIRMO ENCERRAMENTO REAL DO CHAMADO DE TESTE'})});
assert.equal((await encerrarPilotoHml(request('wrong'),env)).status,401);
assert.equal((await encerrarPilotoHml(request(),env)).status,423);
console.log('PASS: encerramento real bloqueado por padrao e protecao unica no SQLite');
