import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {simularCompleto} from './simulacao-completa-hml.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const f of ['001_qr_requests.sql','002_qr_events_automaticos.sql','003_links_conclusao.sql'])sqlite.exec(readFileSync(new URL('./migrations/'+f,import.meta.url),'utf8'));
const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async run(){return {meta:sqlite.prepare(sql).run(...args)}}}}};
const secret='z'.repeat(48),env={CLIGED_AMBIENTE:'homologacao',HML_WRITE_TOKEN:secret,HML_DB:db};
async function call(p,auth=true){const r=await simularCompleto(new Request('https://hml.test/hml/simular',{method:'POST',headers:auth?{Authorization:'Bearer '+secret}:{},body:JSON.stringify(p)}),env);return {http:r.status,...await r.json()};}
const p={idempotency_key:'00000000-0000-4000-8000-000000000005',unit_code:'CLI-MCE',local_code:'B.01',items:['limpeza']};
assert.equal((await call(p,false)).http,401);
const results=await Promise.all(Array.from({length:5},()=>call(p)));
assert.equal(results.filter(r=>r.novo).length,1);assert.ok(results.every(r=>[200,201].includes(r.http)&&r.link_conclusao.includes('#chave=')));
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM qr_requests').get().n,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM qr_events').get().n,2);
assert.equal((await call({...p,unit_code:'ADM-MCE'})).http,409);
sqlite.exec("UPDATE qr_requests SET state='CONCLUIDA'");assert.equal((await call(p)).http,409);
sqlite.close();console.log('OK: criação simulada e link integrados, reenvios sem nova solicitação e bloqueio após conclusão');
