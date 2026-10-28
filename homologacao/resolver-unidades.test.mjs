import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolverLocal } from "./resolver-unidades.mjs";

const catalogo = JSON.parse(readFileSync(new URL("./catalogo-unidades.json", import.meta.url),"utf8"));
assert.equal(Object.keys(catalogo.units["ADM-MCE"].locations).length,19);
assert.equal(Object.keys(catalogo.units["CLI-MCE"].locations).length,8);
assert.deepEqual(
  resolverLocal(catalogo, {local_code:"b.14"}),
  {unit_code:"ADM-MCE",unit_name:"Prédio Administrativo Macaé",local_code:"B.14",
   local_name:"T.I",location_id:"ADM-MCE:B.14",legacy_link:true}
);
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"B.04"}).local_name,
 "RECEPÇÃO 2 EXAMES - BANHEIRO ACESSÍVEL");
assert.equal(resolverLocal(catalogo,{unit_code:"CLI-MCE",local_code:"b.08"}).location_id,"CLI-MCE:B.08");
for (const entrada of [
 {unit_code:"CLI-MCE",local_code:"B.09"},
 {unit_code:"FILIAL-X",local_code:"B.01"},
 {unit_code:"CLI-MCE",local_code:""},
 {unit_code:"CLI-MCE",local_code:"__proto__"},
 {unit_code:"",local_code:"B.01"},
]) assert.throws(()=>resolverLocal(catalogo,entrada));
console.log("OK: 19 ADM + 8 clínica, compatibilidade, identidade, rejeições");
