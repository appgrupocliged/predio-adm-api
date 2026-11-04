export const htmlQrFixos = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CLIGED | QR Codes Clínica Macaé</title><meta name="robots" content="noindex,nofollow">
<style>*{box-sizing:border-box}body{margin:0;background:#111820;color:#f5f5f5;font:15px/1.5 system-ui,Arial}
main{max-width:1200px;margin:auto;padding:32px 20px}.cap{letter-spacing:.12em;color:#dfc68e;font-size:12px;font-weight:800}
h1{font-size:clamp(27px,4vw,42px);margin:9px 0}p{color:#b8c7d0}.panel{border:1px solid #42535e;padding:20px;border-radius:14px;margin:20px 0;background:#1d2a34}
input{min-height:45px;padding:8px 12px;background:#101820;border:1px solid #778b96;border-radius:8px;color:white;font:inherit;max-width:480px;width:100%}
button{background:#dfc68e;color:#15212a;font:800 14px system-ui;padding:13px 18px;border:0;border-radius:9px;cursor:pointer;margin:8px 8px 8px 0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.item{border:2px solid #dfc68e;border-radius:12px;text-align:center;padding:15px;break-inside:avoid;background:#fff;color:#111}
.item h2{font-size:24px;margin:0}.item p{font-size:13px;color:#333;margin:4px 0;min-height:42px}.item svg{width:100%;max-width:225px;height:auto}.item small{display:block;color:#444;overflow-wrap:anywhere;font-size:10px}
#msg{color:#dfc68e}@media(max-width:750px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:490px){.grid{grid-template-columns:1fr}}
@media print{body{background:white;color:black}main{padding:0;max-width:none}.screen{display:none!important}.grid{grid-template-columns:repeat(3,1fr);gap:10px}.item{border-color:#111}}
</style></head><body><main><div class="cap">GRUPO CLIGED · CLÍNICA MACAÉ</div>
<h1>9 QR Codes permanentes</h1>
<p class="screen">Os links não expiram. A abertura real dos chamados depende da liberação técnica no Worker da Clínica. Não instalar os QR Codes antes do aceite operacional.</p>
<section class="panel screen">
<label for="token">Token administrativo de homologação</label>
<div><input id="token" type="password" autocomplete="off" spellcheck="false"></div>
<button id="load">Gerar os 9 QR Codes</button>
<button id="print" disabled>Imprimir folha de QR Codes</button>
<p id="msg" role="status"></p>
</section><section class="grid" id="grid"></section></main>
<script>
(()=>{
 const token=document.getElementById('token'),grid=document.getElementById('grid'),
 load=document.getElementById('load'),print=document.getElementById('print'),msg=document.getElementById('msg');
 load.addEventListener('click',async()=>{
  const secret=token.value;token.value='';if(secret.length<32){msg.textContent='Token inválido.';return;}
  load.disabled=true;print.disabled=true;grid.replaceChildren();msg.textContent='Gerando nove QR Codes...';
  try{
   const res=await fetch('/hml/gestao/qr-fixos',{method:'POST',
    headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
    body:'{}',cache:'no-store',referrerPolicy:'no-referrer'});
   const data=await res.json();if(!res.ok)throw Error(data.mensagem||'Acesso negado.');
   for(const p of data.locais){
    const card=document.createElement('article');card.className='item';
    const h=document.createElement('h2');h.textContent=p.code+' · CLIGED';
    const label=document.createElement('p');label.textContent=p.label;
    const doc=new DOMParser().parseFromString(p.svg,'image/svg+xml');
    if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('QR inválido');
    const qr=document.importNode(doc.documentElement,true);
    const url=document.createElement('small');url.textContent='Clínica CLIGED • '+p.code;
    card.append(h,label,qr,url);grid.append(card);
   }
   if(data.locais.length!==9)throw Error('Série incompleta');
   print.disabled=false;msg.textContent='9 QR Codes fixos gerados. Validar abertura real antes de instalar.';
  }catch(e){grid.replaceChildren();msg.textContent=e.message;}
  finally{load.disabled=false;}
 });
 print.addEventListener('click',()=>{if(!print.disabled)window.print();});
})();
</script></body></html>`;
