import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {solicitarClinicaReal} from './abertura-real-clinica-hml.mjs';
import {htmlClinicaReal} from './solicitante-real-page-hml.mjs';
import {htmlQrFixos} from './qr-fixos-page-hml.mjs';
import {gestaoHml} from './gestao-hml.mjs';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE qr_requests(idempotency_key TEXT PRIMARY KEY)');
db.exec(readFileSync(new URL('./migrations/009_clinica_live.sql',import.meta.url),'utf8'));
const now=Math.floor(Date.now()/1000);
const insert=db.prepare("INSERT INTO hml_clinic_live_rate(location_id,last_sent_at) VALUES(?,?) ON CONFLICT(location_id) DO UPDATE SET last_sent_at=excluded.last_sent_at WHERE hml_clinic_live_rate.last_sent_at<=?");
assert.equal(insert.run('CLI-MCE:B.01',now,now-60).changes,1);
assert.equal(insert.run('CLI-MCE:B.01',now,now-60).changes,0);
db.close();
const env={CLIGED_AMBIENTE:'homologacao',HML_DB:{prepare(){throw Error('DB accessed while disabled')}},HML_WRITE_TOKEN:'x'.repeat(48)};
let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('network accessed');};
try{
 const req=new Request('https://hml.test/hml/clinica/solicitar',{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:'47dfa4cf-4fcc-4508-b14d-7001c7cb43c8',unit_code:'CLI-MCE',local_code:'B.01',items:['Papel higiênico']})});
 const result=await solicitarClinicaReal(req,env);
 assert.equal(result.status,423);
 assert.equal(calls,0);
 for(const html of [htmlClinicaReal,htmlQrFixos]){
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 }
 const qr=await gestaoHml(new Request('https://hml.test/hml/gestao/qr-fixos',{method:'POST',headers:{Authorization:'Bearer '+env.HML_WRITE_TOKEN}}),env);
 const data=await qr.json();
 assert.equal(data.locais.length,9);
 assert.ok(data.locais.every(v=>v.url.includes('/hml/clinica/solicitar?')&&v.url.includes('unidade=CLI-MCE')&&v.svg.includes('<svg')));
 assert.equal(new Set(data.locais.map(x=>x.url)).size,9);
 assert.ok(data.locais.every(x=>!x.url.includes('sessao=')));
 console.log('PASS: QR permanentes únicos, formulário válido, abertura real desativada sem chamadas externas e limite D1');
}finally{globalThis.fetch=old;}
