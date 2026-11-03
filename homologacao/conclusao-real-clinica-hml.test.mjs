import assert from 'node:assert/strict';
import {conclusaoRealClinica} from './conclusao-real-clinica-hml.mjs';
import {htmlAtendimentoReal} from './atendimento-real-page-hml.mjs';
import {Script} from 'node:vm';
let queries=0,calls=0;const prev=globalThis.fetch;
globalThis.fetch=async()=>{calls++;throw Error('No external requests permitted in test');};
try{
 const env={CLIGED_AMBIENTE:'homologacao',HML_DB:{prepare(){queries++;throw Error('Should not query');}},
  HML_WRITE_TOKEN:'x'.repeat(48)};
 const r=await conclusaoRealClinica(new Request('https://hml.invalid/hml/real/links/concluir',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({token:'a'.repeat(43),nome:'Colaboradora'})
 }),env);
 assert.equal(r.status,423);
 assert.equal((await r.json()).status,'DESATIVADO');
 assert.equal(queries,0);assert.equal(calls,0);
 assert.ok(htmlAtendimentoReal.includes('/hml/real/links/'));
 const script=htmlAtendimentoReal.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 console.log('PASS: encerramento real da colaboradora desativado por padrao; sem rede, D1 ou alteracao de producao');
}finally{globalThis.fetch=prev;}
