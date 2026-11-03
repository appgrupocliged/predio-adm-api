import assert from 'node:assert/strict';
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
 console.log('PASS: piloto externo bloqueado sem habilitação e credenciais próprias');
}finally{globalThis.fetch=oldFetch;}
