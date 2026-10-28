// Painel de homologação de QR Codes — sem operações TomTicket.
export function htmlPainel() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CLIGED | Homologação de QR Codes</title>
<style>
:root{color-scheme:dark;--bg:#101216;--panel:#1a1d23;--line:#3e4550;--gold:#f0d99a;--fg:#f2f3f5;--muted:#b1b6bf;--green:#74d3a9}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:840px;margin:auto;padding:34px 18px 70px}
.head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
.brand{font-weight:800;letter-spacing:.12em;color:var(--gold);font-size:21px}
.tag{border:1px solid var(--gold);color:var(--gold);border-radius:25px;padding:5px 12px;font-size:12px;font-weight:700}
h1{font-size:clamp(25px,5vw,38px);line-height:1.15;margin:29px 0 12px}
p{color:var(--muted)}.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;margin-top:22px}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.metric{background:#12151b;padding:14px;border-radius:10px;text-align:center}
.metric strong{display:block;font-size:26px;color:var(--gold)}.metric span{font-size:12px;color:var(--muted)}
label{display:block;font-size:13px;font-weight:700;margin:13px 0 5px;color:var(--muted)}
select,button{min-height:46px;border:1px solid #656d7a;background:#101216;color:var(--fg);border-radius:9px;padding:10px 12px;font:inherit;width:100%}
select:focus-visible,button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
button{margin-top:18px;background:var(--gold);color:#171a21;border:0;cursor:pointer;font-weight:800}
button:disabled{opacity:.6;cursor:not-allowed}
#feedback{margin-top:16px;min-height:48px;padding:12px;border-radius:9px;background:#13171d;white-space:pre-wrap;overflow-wrap:anywhere}
.good{border:1px solid var(--green);color:var(--green)}.bad{border:1px solid #ef9696;color:#efb0b0}
.note{font-size:13px;border-left:3px solid var(--gold);padding-left:12px;margin-top:20px}
code{color:var(--gold)}footer{font-size:12px;color:var(--muted);margin-top:30px}
</style></head><body><main>
<div class="head"><span class="brand">GRUPO CLIGED · QR</span><span class="tag">AMBIENTE DE HOMOLOGAÇÃO</span></div>
<h1>Validação de unidades e locais</h1>
<p>Confira a identificação de cada ponto antes de liberar QR Codes ou integrar solicitações reais.</p>
<section class="card" aria-label="Visão geral">
<div class="metrics"><div class="metric"><strong id="admCount">—</strong><span>Prédio ADM</span></div><div class="metric"><strong id="cliCount">—</strong><span>Clínica</span></div><div class="metric"><strong id="totalCount">—</strong><span>Total</span></div></div>
</section>
<section class="card" aria-label="Testar identificação">
<label for="unit">Unidade</label><select id="unit"><option value="">Carregando catálogo…</option></select>
<label for="place">Local / banheiro</label><select id="place"><option value="">Selecione uma unidade</option></select>
<button type="button" id="verify" disabled>VALIDAR IDENTIFICAÇÃO</button>
<div id="feedback" role="status" aria-live="polite">Carregando…</div>
<p class="note">Ambiente de simulação: nenhuma validação cria, transfere ou encerra chamados no TomTicket, e nenhuma notificação é enviada ao Google Chat.</p>
</section>
<footer>Somente homologação · ADM-MCE / CLI-MCE · Não utilize para solicitar serviços.</footer>
</main>
<script>
(() => {
"use strict";
const unit = document.getElementById("unit"), place = document.getElementById("place");
const verify = document.getElementById("verify"), feedback = document.getElementById("feedback");
let catalog = [];
function status(message, ok) {
 feedback.textContent = message;
 feedback.className = ok === true ? "good" : ok === false ? "bad" : "";
}
function addOption(select, code, name) {
 const option = document.createElement("option");
 option.value = code; option.textContent = name; select.appendChild(option);
}
function populatePlaces() {
 place.replaceChildren(); const selected = catalog.find(item => item.codigo === unit.value);
 if (selected) for (const l of selected.locais) addOption(place, l.codigo, l.codigo + " — " + l.nome);
 verify.disabled = !selected || !selected.locais.length;
 if (selected) status("Selecione o local e clique em VALIDAR IDENTIFICAÇÃO.");
}
verify.addEventListener("click",async () => {
 verify.disabled = true; status("Validando local na API isolada…");
 try {
 const response=await fetch("validar",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({unit_code:unit.value,local_code:place.value})});
 const data=await response.json();
 if(!response.ok || !data.sucesso) throw Error(data.mensagem || "Falha de validação.");
 const item=data.local;
 status("VALIDADO ✓\nIdentificador: " + item.location_id + "\nUnidade: " + item.unit_name +
 "\nLocal: " + item.local_name + "\nOrigem: API de homologação (sem TomTicket).",true);
 } catch(e) { status("Falha: " + e.message,false); }
 finally { verify.disabled = !unit.value; }
});
unit.addEventListener("change",populatePlaces);
const params = new URLSearchParams(location.search);
fetch("catalogo").then(response=>{if(!response.ok)throw Error("Falha ao carregar catálogo.");return response.json();})
.then(data=>{
 catalog=data.unidades;
 unit.replaceChildren();
 for(const u of catalog)addOption(unit,u.codigo,u.nome+" ("+u.codigo+")");
 document.getElementById("admCount").textContent=catalog.find(u=>u.codigo==="ADM-MCE")?.locais.length ?? "—";
 document.getElementById("cliCount").textContent=catalog.find(u=>u.codigo==="CLI-MCE")?.locais.length ?? "—";
 document.getElementById("totalCount").textContent=catalog.reduce((sum,u)=>sum+u.locais.length,0);
 const requestedUnit=params.get("unidade") || params.get("unit_code") || (params.has("local") ? "ADM-MCE" : "CLI-MCE");
 if(catalog.some(u=>u.codigo===requestedUnit))unit.value=requestedUnit;
 populatePlaces();
 const requestedLocal=params.get("local");
 if(requestedLocal && [...place.options].some(o=>o.value===requestedLocal))place.value=requestedLocal;
}).catch(e=>{unit.replaceChildren();place.replaceChildren();status("Não foi possível carregar o catálogo: "+e.message,false);});
})();
</script></body></html>`;
}
