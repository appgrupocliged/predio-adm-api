// Página permanente por local. Não contém token administrativo nem endpoints de produção.
export const htmlClinicaReal = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>CLIGED | Solicitar limpeza e reposição</title>
<style>
:root{color-scheme:dark;--gold:#dfc68e;--fg:#f6f6f6;--muted:#b8c7d0}
*{box-sizing:border-box}body{margin:0;background:#111820;color:var(--fg);font:16px/1.5 system-ui,Arial}
main{max-width:620px;margin:auto;padding:30px 18px 60px}small{color:var(--gold);letter-spacing:.12em;font-weight:700}
h1{font-size:clamp(25px,5vw,37px);line-height:1.2;margin:9px 0}p{color:var(--muted)}
.card{background:#1d2a34;border:1px solid #3e5360;padding:23px;border-radius:17px;margin:20px 0}
h2{font-size:20px}.row{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #42505a}
input[type=checkbox]{width:22px;height:22px;accent-color:#dfc68e;flex:none}
button{border:0;border-radius:10px;background:var(--gold);color:#13202b;font:800 16px system-ui;cursor:pointer;padding:16px 20px;width:100%;margin-top:20px}
button:disabled{opacity:.45;cursor:wait}
#msg{white-space:pre-wrap}#result{display:none}
</style></head><body><main><small>GRUPO CLIGED · CLÍNICA MACAÉ</small>
<h1>Solicitar limpeza ou reposição</h1><p>O QR Code identifica automaticamente o banheiro.</p>
<div class="card" id="form">
<h2 id="local">Identificando local...</h2><p>Selecione o que precisa ser realizado:</p>
<div id="services"></div><button id="send" disabled>ENVIAR SOLICITAÇÃO</button>
<p id="msg" role="status" aria-live="polite"></p></div>
<div class="card" id="result"><h2 id="resultTitle"></h2><p id="resultMessage"></p></div>
<script>
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const unit=params.get('unidade'),local=params.get('local');
const services=['Papel higiênico','Papel toalha','Sabonete líquido','Troca/retirada de lixo','limpeza'];
const labels=['Papel higiênico','Papel toalha','Sabonete líquido','Troca ou retirada de lixo','Solicitar limpeza'];
const box=document.getElementById('services'),message=document.getElementById('msg');
const button=document.getElementById('send');let pending=null,busy=false;
const select=[];
function checked(){button.disabled=busy||!select.some(e=>e.checked);}
function fail(t){message.textContent=t;button.disabled=true;}
for(let i=0;i<services.length;i++){
 const row=document.createElement('label');row.className='row';
 const cb=document.createElement('input');cb.type='checkbox';cb.value=services[i];
 const span=document.createElement('span');span.textContent=labels[i];
 row.append(cb,span);box.append(row);select.push(cb);cb.addEventListener('change',checked);
}
if(unit!=='CLI-MCE'||!/^B\\.0[1-9]$/.test(local||'')){
 fail('QR Code inválido para a Clínica.');return;
}
fetch('/catalogo',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
 const u=data.unidades.find(x=>x.codigo===unit),p=u?.locais.find(x=>x.codigo===local);
 if(!p)throw Error();
 document.getElementById('local').textContent=local+' — '+p.nome;
 checked();
}).catch(()=>fail('Não foi possível identificar o banheiro.'));
button.addEventListener('click',async()=>{
 if(busy||button.disabled)return;
 if(!pending)pending={idempotency_key:crypto.randomUUID(),unit_code:unit,local_code:local,
  items:select.filter(x=>x.checked).map(x=>x.value)};
 busy=true;checked();message.textContent='Registrando solicitação...';
 try{
  const response=await fetch('/hml/clinica/solicitar',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(pending),cache:'no-store',referrerPolicy:'no-referrer'});
  const data=await response.json();
  if(!response.ok)throw Error(data.mensagem||'Falha no atendimento.');
  document.getElementById('form').style.display='none';
  document.getElementById('result').style.display='block';
  document.getElementById('resultTitle').textContent='Solicitação registrada';
  document.getElementById('resultMessage').textContent=data.mensagem||'A equipe foi notificada.';
 }catch(e){
  // Não criar nova chave para retry após resultado incerto.
  message.textContent=e.message+' Não recarregue ou abra outra solicitação antes de confirmar com a equipe.';
 }finally{busy=false;checked();}
});
})();
</script></main></body></html>`;
