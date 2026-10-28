import assert from "node:assert/strict";
import worker from "./worker-hml.mjs";

async function chamada(path, method="GET", body) {
  const resposta = await worker.fetch(new Request("https://cliged-hml.example"+path,{
    method,
    ...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
  }),{});
  return {status:resposta.status, body:await resposta.json()};
}
let resultado=await chamada("/");
assert.equal(resultado.status,200);
assert.equal(resultado.body.unidades,2);
assert.equal(resultado.body.locais,28);
resultado=await chamada("/catalogo");
assert.equal(resultado.body.unidades[0].locais.length,19);
assert.equal(resultado.body.unidades[1].locais.length,9);
resultado=await chamada("/validar","POST",{local_code:"B.14"});
assert.equal(resultado.body.local.location_id,"ADM-MCE:B.14");
resultado=await chamada("/validar","POST",{unidade:"CLI-MCE",local:"B.04"});
assert.equal(resultado.body.local.local_name,"RECEPÇÃO 2 EXAMES - BANHEIRO ACESSÍVEL");
for (const body of [
 {unit_code:"CLI-MCE",local_code:"B.10"},
 {unit_code:"ADM-MCE",local_code:"B.20"},
 {unit_code:"FILIAL-XX",local_code:"B.01"}
]) assert.equal((await chamada("/validar","POST",body)).status,400);
for(const route of ["/solicitacao","/concluir","/status","/push/subscribe","/push/test"]){
  assert.equal((await chamada(route,"POST",{})).status,503);
}
assert.equal((await chamada("/validar","POST",{unit_code:"CLI-MCE",local_code:"B.01"})).body.local.location_id,"CLI-MCE:B.01");
assert.equal((await chamada("/validar","POST",{unit_code:"CLI-MCE",local_code:"B.05"})).body.local.local_name,"SALA RPA");
assert.equal((await chamada("/validar","POST",{unit_code:"CLI-MCE",local_code:"B.09"})).body.local.local_name,"SALA EXAMES 2");
console.log("OK: 2 unidades, 28 locais, QR legado, banheiros clinica, bloqueios de operacoes reais");
