import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepararSolicitacao, autorizarConclusao } from "./operacao-core.mjs";
const catalogo=JSON.parse(readFileSync(new URL("./catalogo-unidades.json",import.meta.url),"utf8"));
const key="d4e59717-7f7e-4660-a014-11d2ebf615ae";
const base={idempotency_key:key,unit_code:"CLI-MCE",local_code:"B.05",items:["Papel toalha","limpeza"]};
const a=await prepararSolicitacao(catalogo,base);
const b=await prepararSolicitacao(catalogo,{...base,items:["limpeza","Papel toalha"]});
assert.equal(a.location_id,"CLI-MCE:B.05");
assert.equal(a.local_name,"SALA RPA");
assert.equal(a.fingerprint,b.fingerprint);
assert.equal(a.assunto,"Solicitação - Clínica CLIGED Macaé - B.05 - SALA RPA");
assert.match(a.mensagem,/Solicitar limpeza/);
const clinic=await prepararSolicitacao(catalogo,{...base,local_code:"B.09"});
const adm=await prepararSolicitacao(catalogo,{...base,unit_code:"ADM-MCE",local_code:"B.05"});
assert.equal(clinic.local_name,"SALA EXAMES 2");
assert.equal(adm.location_id,"ADM-MCE:B.05");
assert.notEqual(clinic.fingerprint,adm.fingerprint);
for(const data of [
 {...base,idempotency_key:"same"},
 {...base,unit_code:"CLI-MCE",local_code:"B.10"},
 {...base,items:[]},
 {...base,items:["Papel toalha","Papel toalha"]},
 {...base,items:["Apagar chamado"]},
 {...base,items:"limpeza"}
]) await assert.rejects(()=>prepararSolicitacao(catalogo,data));
const registro={status:"ABERTO",ticket_id:"ticket-teste",unit_code:"CLI-MCE",local_code:"B.05"};
const enviado={ticket_id:"ticket-teste",unit_code:"CLI-MCE",local_code:"B.05"};
const principal={accessJwtVerified:true,policyAllowed:true,subject:"colaboradora.test@cliged.invalid"};
assert.equal(autorizarConclusao(registro,enviado,principal).location_id,"CLI-MCE:B.05");
for(const [r,s,p] of [
 [registro,enviado,{}],
 [registro,enviado,{...principal,policyAllowed:false}],
 [registro,{...enviado,local_code:"B.06"},principal],
 [{...registro,status:"CONCLUIDO"},enviado,principal],
 [registro,{...enviado,ticket_id:"outro"},principal],
]) assert.throws(()=>autorizarConclusao(r,s,p));
console.log("OK: validação, fingerprint, unidade, autorização e negações");
