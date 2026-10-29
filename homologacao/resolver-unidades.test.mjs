import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolverLocal } from "./resolver-unidades.mjs";

const catalogo = JSON.parse(readFileSync(new URL("./catalogo-unidades.json", import.meta.url),"utf8"));
assert.equal(Object.keys(catalogo.units["ADM-MCE"].locations).length,19);
assert.equal(Object.keys(catalogo.units["CLI-MCE"].locations).length,9);
assert.deepEqual(
  resolverLocal(catalogo, {local_code:"b.14"}),
  {unit_code:"ADM-MCE",unit_name:"Prédio Administrativo Macaé",local_code:"B.14",
   local_name:"T.I",location_id:"ADM-MCE:B.14",legacy_link:true}
);
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"B.04"}).local_name,
 "RECEPÇÃO 2 EXAMES - BANHEIRO ACESSÍVEL");
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"b.08"}).location_id,"CLI-MCE:B.08");
for (const entrada of [
 {unit_code:"CLI-MCE",local_code:"B.10"},
 {unit_code:"FILIAL-X",local_code:"B.01"},
 {unit_code:"CLI-MCE",local_code:""},
 {unit_code:"CLI-MCE",local_code:"__proto__"},
 {unit_code:"",local_code:"B.01"},
]) assert.throws(()=>resolverLocal(catalogo,entrada));
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"B.05"}).local_name,"SALA RPA");
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"B.09"}).local_name,"SALA EXAMES 2");
// Verificação completa: 28 locais únicos por unidade, com código e nome corretos.
const ids = new Set();
let verificados = 0;
for (const [codigoUnidade, unidade] of Object.entries(catalogo.units)) {
  for (const [codigoLocal, nomeLocal] of Object.entries(unidade.locations)) {
    const local = resolverLocal(catalogo, {
      unit_code: codigoUnidade,
      local_code: codigoLocal
    });
    assert.equal(local.location_id, codigoUnidade + ":" + codigoLocal);
    assert.equal(local.unit_name, unidade.name);
    assert.equal(local.local_name, nomeLocal);
    assert.equal(local.legacy_link, false);
    assert.equal(ids.has(local.location_id), false, "Identificador duplicado");
    ids.add(local.location_id);
    verificados++;
    if (codigoUnidade === catalogo.default_unit) {
      const legado = resolverLocal(catalogo, { local_code: codigoLocal });
      assert.equal(legado.location_id, local.location_id);
      assert.equal(legado.legacy_link, true);
    }
  }
}
assert.equal(verificados, 28);

console.log("OK: 19 ADM + 9 clínica, compatibilidade, identidade, rejeições, 28 pontos verificados");
