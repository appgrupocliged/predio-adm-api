import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {preflightIntegracaoHml} from './integracao-preflight-hml.mjs';
import {prepararSolicitacao} from './operacao-core.mjs';
import catalogo from './catalogo-unidades.json' with {type:'json'};
import {htmlGestao} from './gestao-page-hml.mjs';
import {Script} from 'node:vm';

const sqlite=new DatabaseSync(':memory:');
for(const f of ['001_qr_requests.sql','002_qr_events_automaticos.sql'])
  sqlite.exec(readFileSync(new URL('./migrations/'+f,import.meta.url),'utf8'));
const db={prepare(sql){let params=[];return{
  bind(...xs){params=xs;return this},
  async first(){return sqlite.prepare(sql).get(...params)??null}
};}};
const secret='h'.repeat(48);
const env={CLIGED_AMBIENTE:'homologacao',HML_DB:db,HML_WRITE_TOKEN:secret};
const key='00000000-0000-4000-8000-000000000091';
const pedido=await prepararSolicitacao(catalogo,{idempotency_key:key,unit_code:'CLI-MCE',local_code:'B.01',items:['Papel toalha']});
sqlite.prepare("INSERT INTO qr_requests(idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state,ticket_id) VALUES (?,?,?,?,?,?,'ABERTA',?)").run(
  key,pedido.fingerprint,pedido.unit_code,pedido.local_code,pedido.location_id,JSON.stringify(pedido.servicos),'SIM-'+key
);
async function request(k,token=secret){
 const response=await preflightIntegracaoHml(new Request('https://hml.test/hml/integracao/preflight',{
   method:'POST',headers:token?{Authorization:'Bearer '+token}:{},
   body:JSON.stringify({idempotency_key:k})
 }),env);
 return {http:response.status,...await response.json()};
}
assert.equal((await request(key,'')).http,401);
assert.equal((await request('00000000-0000-4000-8000-000000000099')).http,409);
const result=await request(key);
assert.equal(result.http,200);
assert.equal(result.status,'CONTRATOS_VALIDADOS');
assert.equal(result.chamada_externa_realizada,false);
assert.equal(result.location_id,'CLI-MCE:B.01');
assert.deepEqual(result.validacoes.map(x=>x.etapa),['criar','vincular_gleice','inserir_link','notificar_chat']);
assert.match(result.validacoes[0].subject,/Clínica CLIGED Macaé/);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM qr_requests').get().n,1);
assert.equal(sqlite.prepare('SELECT state FROM qr_requests').get().state,'ABERTA');
assert.ok(htmlGestao.includes('Validar integração'));
const script=htmlGestao.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
assert.doesNotThrow(()=>new Script(script));
sqlite.close();
console.log('OK: preflight HML autentica, usa D1, valida 4 contratos sem escrita ou rede externa');
