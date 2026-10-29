import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepararSolicitacao} from "./operacao-core.mjs";
import {prepararPlanoIntegracao} from "./planos-integracao-hml.mjs";
const catalogo=JSON.parse(readFileSync(new URL("./catalogo-unidades.json",import.meta.url),"utf8"));
const pedido=await prepararSolicitacao(catalogo,{idempotency_key:"d4e59717-7f7e-4660-a014-11d2ebf615ae",unit_code:"CLI-MCE",local_code:"B.09",items:["Papel toalha","limpeza"]});
const config={customer_id:"cliente-simulado@cliged.invalid",department_id:"DEP-TEST",operator_id:"GLEICE-TEST",ticket_id_simulado:"SIM-123",concluir_url:"https://cliged-qr-hml-isolado.appgrupocliged.workers.dev/atendimento"};
const plan=prepararPlanoIntegracao(pedido,config);
assert.equal(plan.modo,"SIMULACAO_SEM_REDE");
assert.deepEqual(plan.passos.map(x=>x.nome),["criar","vincular_gleice","inserir_link","notificar_chat"]);
const criar=new URLSearchParams(plan.passos[0].body);
assert.equal(criar.get("subject"),"Solicitação - Clínica CLIGED Macaé - B.09 - SALA EXAMES 2");
assert.match(criar.get("message"),/SALA EXAMES 2/);
assert.equal(plan.passos[1].body.operator_id,"GLEICE-TEST");
const link=new URL(new URLSearchParams(plan.passos[2].body).get("message").split("\n\n")[1]);
assert.equal(link.searchParams.get("unidade"),"CLI-MCE");
assert.equal(link.searchParams.get("local"),"B.09");
assert.equal(link.searchParams.get("id"),"SIM-123");
assert.match(plan.passos[3].body.text,/Clínica CLIGED Macaé/);
assert.match(plan.passos[3].body.text,/SALA EXAMES 2/);
assert.equal(JSON.stringify(plan).includes("api.tomticket.com"),false);
for(const options of [
 {...config,concluir_url:"https://appgrupocliged.github.io/predio-adm/concluir.html"},
 {...config,ticket_id_simulado:"REAL-123"},
 {...config,concluir_url:"http://unsafe.invalid/atendimento"}
])assert.throws(()=>prepararPlanoIntegracao(pedido,options));
console.log("OK: etapas simuladas, Gleice, unidade e links, sem rede real");
