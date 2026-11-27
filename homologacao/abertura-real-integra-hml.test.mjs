import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {solicitarClinicaReal} from './abertura-real-clinica-hml.mjs';
const sql=new DatabaseSync(':memory:');
for(const name of ['001_qr_requests.sql','002_qr_events_automaticos.sql','008_conclusao_colaboradora_real.sql','009_clinica_live.sql'])
 sql.exec(readFileSync(new URL('./migrations/'+name,import.meta.url),'utf8'));
const db={prepare(query){let a=[];return {
 bind(...params){a=params;return this},
 async first(){return sql.prepare(query).get(...a)||null},
 async run(){const m=sql.prepare(query).run(...a);return {meta:{changes:Number(m.changes)}}}
};}};
const env={
 CLIGED_AMBIENTE:'homologacao',HML_CLINIC_LIVE_ENABLED:'SIM_APROVADO',HML_CLINIC_LIVE_ALLOWED_LOCAL:'B.03',HML_DB:db,
 HML_TOMTICKET_TOKEN:'mock',HML_PILOT_CUSTOMER_ID:'clinica@example.test',
 HML_PILOT_DEPARTMENT_ID:'dep',HML_PILOT_OPERATOR_ID:'gleice',
 HML_GOOGLE_CHAT_WEBHOOK_URL:'https://chat.googleapis.com/v1/spaces/demo/messages?key=mock&token=mock'
};
const old=globalThis.fetch,calls=[];
if(process.argv.includes('--clinica-producao'))env.CLIGED_AMBIENTE='clinica-producao';
globalThis.fetch=async(url,init)=>{
 calls.push({url:String(url),body:init.body});
 if(String(url).endsWith('/ticket/new'))return new Response(JSON.stringify({ticket_id:'TEST-'+(4408+calls.filter(c=>c.url.endsWith('/ticket/new')).length)}));
 if(String(url).endsWith('/ticket/transfer'))return new Response('{"success":true}');
 if(String(url).endsWith('/ticket/reply/customer'))return new Response('{"success":true}');
 if(String(url).startsWith('https://chat.googleapis.com/'))return new Response('{"name":"ok"}');
 throw Error('External URL not expected');
};
const key='00000000-0000-4000-8000-000000000083';
const payload={idempotency_key:key,unit_code:'CLI-MCE',local_code:'B.03',items:['Papel higiênico']};
const post=body=>solicitarClinicaReal(new Request('https://hml.invalid/hml/clinica/solicitar',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
try{
 const created=await post(payload);assert.equal(created.status,201);assert.equal((await created.json()).estado,'ABERTA');
 assert.equal(calls.length,4);
 const chatText=JSON.parse(calls[3].body).text;
 assert.equal(chatText.includes('Chamado:'),env.CLIGED_AMBIENTE!=='clinica-producao');
 assert.ok(chatText.includes('Concluir:'));
 const row=sql.prepare('SELECT state,ticket_id FROM qr_requests WHERE idempotency_key=?').get(key);
 assert.equal(row.state,'ABERTA');assert.equal(row.ticket_id,'TEST-4409');
 assert.equal(sql.prepare('SELECT stage FROM hml_clinic_live_dispatch WHERE request_key=?').get(key).stage,'ATIVO');
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM hml_real_completion_links').get().n,1);
 const duplicate=await post(payload);assert.equal(duplicate.status,200);assert.equal(calls.length,4);
 const other=await post({...payload,idempotency_key:'00000000-0000-4000-8000-000000000084'});
 assert.equal(other.status,429);assert.equal(calls.length,4);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM qr_requests').get().n,1);
 // O novo B.10 só é liberado com TODOS_10; TODOS_9 continua atendendo B.01–B.09.
 env.CLIGED_AMBIENTE='clinica-producao';
 env.HML_CLINIC_LIVE_ALLOWED_LOCAL='TODOS_9';
 const acolhimento={...payload,idempotency_key:'00000000-0000-4000-8000-000000000085',local_code:'B.10'};
 const denied=await post(acolhimento);assert.equal(denied.status,403);assert.equal(calls.length,4);
 env.HML_CLINIC_LIVE_ALLOWED_LOCAL='TODOS_10';
 const permitted=await post(acolhimento);
 assert.equal(permitted.status,201);
 assert.equal((await permitted.json()).estado,'ABERTA');
 assert.equal(calls.length,8);
 const bodyTomTicket=new URLSearchParams(calls[4].body);
 assert.equal(bodyTomTicket.get('subject'),'Solicitação - Clínica Matriz - B.10 — BANHEIRO — SALA ACOLHIMENTO');
 assert.ok(bodyTomTicket.get('message').includes('Local: B.10 — BANHEIRO — SALA ACOLHIMENTO'));
 assert.ok(JSON.parse(calls[7].body).text.includes('Local: B.10 — BANHEIRO — SALA ACOLHIMENTO'));
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM qr_requests').get().n,2);
 // S.01 é setor, não banheiro: somente TODOS_11 habilita S.01 em produção.
 const setor={...payload,idempotency_key:'00000000-0000-4000-8000-000000000086',local_code:'S.01',items:['limpeza']};
 const setorBloqueado=await post(setor);
 assert.equal(setorBloqueado.status,403);
 assert.equal(calls.length,8);
 env.HML_CLINIC_LIVE_ALLOWED_LOCAL='TODOS_11';
 const setorPermitido=await post(setor);
 assert.equal(setorPermitido.status,201);
 assert.equal((await setorPermitido.json()).estado,'ABERTA');
 assert.equal(calls.length,12);
 const mensagemSetor=new URLSearchParams(calls[8].body);
 assert.equal(mensagemSetor.get('subject'),'Solicitação - Clínica Matriz - S.01 — SETOR — SALA CTA');
 assert.ok(mensagemSetor.get('message').includes('Local: S.01 — SETOR — SALA CTA'));
 assert.ok(JSON.parse(calls[11].body).text.includes('Local: S.01 — SETOR — SALA CTA'));
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM qr_requests').get().n,3);
 console.log('PASS: B.03, B.10 Acolhimento e S.01 CTA; abertura→TomTicket→Chat e flags compatíveis');
}finally{globalThis.fetch=old;sql.close();}
