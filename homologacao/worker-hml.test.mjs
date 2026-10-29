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

// Painel HML disponível exclusivamente para consulta, sem operações reais.
const responsePainel = await worker.fetch(new Request("https://cliged-hml.example/painel"),{});
assert.equal(responsePainel.status,200);
assert.match(responsePainel.headers.get("content-type"),/text\/html/);
const htmlPainel = await responsePainel.text();
assert.match(htmlPainel,/AMBIENTE DE HOMOLOGAÇÃO/);
assert.match(htmlPainel,/VALIDAR IDENTIFICAÇÃO/);
assert.match(htmlPainel,/fetch\("catalogo"\)/);
assert.match(htmlPainel,/fetch\("validar"/);

// A API deve validar todos os pontos, inclusive códigos iguais em unidades distintas.
const catalogo = (await chamada("/catalogo")).body.unidades;
let totalPontos = 0;
for (const unidade of catalogo) {
  for (const ponto of unidade.locais) {
    const resposta = await chamada("/validar", "POST", {
      unit_code: unidade.codigo,
      local_code: ponto.codigo
    });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.local.location_id, unidade.codigo + ":" + ponto.codigo);
    assert.equal(resposta.body.local.local_name, ponto.nome);
    totalPontos++;
  }
}
assert.equal(totalPontos, 28);
assert.equal((await chamada("/validar", "POST", { local_code: "B.01" })).body.local.location_id, "ADM-MCE:B.01");


// As duas telas HML devem preservar elementos originais e não carregar o Worker de produção.
for (const [route,required] of [
  ["/solicitante?unidade=CLI-MCE&local=B.05",["Avise nossa equipe","Papel higiênico","SIMULAÇÃO","id=\"send\""]],
  ["/atendimento?id=SIM-ABC12345&unidade=CLI-MCE&local=B.05",["Concluir solicitação","Nome da colaboradora","SIMULAÇÃO","id=\"concluir\""]]
]) {
  const response = await worker.fetch(new Request("https://cliged-hml.example"+route),{});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type"),/text\/html/);
  const html = await response.text();
  for (const text of required) assert.ok(html.includes(text),"HTML HML sem: "+text);
  assert.ok(!html.includes("predio-adm-api.appgrupocliged.workers.dev"),"Frontend com API de produção!");
  assert.ok(!html.includes('src="sw.js"'),"Service Worker de produção detectado!");
}

console.log("OK: 2 unidades, 28 locais, QR legado, banheiros clinica, bloqueios de operacoes reais");
