import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {conclusaoRealClinica} from './conclusao-real-clinica-hml.mjs';
const sql=new DatabaseSync(':memory:');
for(const name of ['001_qr_requests.sql','002_qr_events_automaticos.sql','008_conclusao_colaboradora_real.sql'])
 sql.exec(readFileSync(new URL('./migrations/'+name,import.meta.url),'utf8'));
const db={prepare(query){let a=[];return{
 bind(...params){a=params;return this},
 async first(){return sql.prepare(query).get(...a)||null},
 async run(){const m=sql.prepare(query).run(...a);return {meta:{changes:Number(m.changes)}};}
};}};
const key='00000000-0000-4000-8000-000000000085',token='A'.repeat(43);
const hashed=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
sql.prepare("INSERT INTO qr_requests(idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state,ticket_id) VALUES (?,?,?,?,?,?,'ABERTA',?)")
 .run(key,'a'.repeat(64),'CLI-MCE','B.01','CLI-MCE:B.01','["Papel higiênico"]','TICKET-TESTE');
sql.prepare('INSERT INTO hml_real_completion_links(token_hash,request_key,expires_at) VALUES(?,?,?)')
 .run(hashed,key,Math.floor(Date.now()/1000)+300);
const env={
 CLIGED_AMBIENTE:'homologacao',HML_DB:db,HML_CLINIC_REAL_COMPLETION_ENABLED:'SIM_APROVADO',
 HML_TOMTICKET_TOKEN:'mock',HML_GOOGLE_CHAT_WEBHOOK_URL:'https://chat.googleapis.com/v1/spaces/test/messages?key=test'
};
const calls=[],old=globalThis.fetch;
globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:init.body});
 if(String(url).endsWith('/ticket/finish'))return new Response('{"success":true}');
 if(String(url).startsWith('https://chat.googleapis.com/'))return new Response('{"name":"posted"}');
 throw Error('Unexpected outgoing route');
};
const post=(kind,body)=>conclusaoRealClinica(new Request('https://hml.test/hml/real/links/'+kind,{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
}),env);
try{
 assert.equal((await post('consultar',{token})).status,200);
 const done=await post('concluir',{token,nome:'Colaboradora de Teste'});
 assert.equal(done.status,200);
 assert.equal((await done.json()).status,'CHAT_ENVIADO');
 assert.equal(calls.length,2);
 assert.equal(sql.prepare('SELECT state,actor FROM qr_requests').get().state,'CONCLUIDA');
 assert.equal(sql.prepare('SELECT state FROM hml_real_completion_dispatch').get().state,'CHAT_ENVIADO');
 assert.equal((await post('concluir',{token,nome:'Colaboradora de Teste'})).status,409);
 assert.equal(calls.length,2);
 assert.ok(String(calls[1].body).includes('Realizado por:'));
 console.log('PASS: concluir ticket por link, notificar Chat, gravar D1 e impedir segundo finish');
}finally{globalThis.fetch=old;sql.close();}
