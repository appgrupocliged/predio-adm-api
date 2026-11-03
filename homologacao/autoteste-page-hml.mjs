// Interface local de HML: token somente em memória, sem armazenamento ou logging.
export const htmlAutoteste = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CLIGED — Autoteste HML</title>
<style>:root{color-scheme:dark;font:16px system-ui,Arial}*{box-sizing:border-box}body{margin:0;background:#111820;color:#f4f6f8;min-height:100vh;display:grid;place-items:center;padding:22px}main{width:min(640px,100%);background:#1e2a34;border:1px solid #354753;border-radius:20px;padding:30px}h1{font-size:clamp(25px,4vw,36px);margin:10px 0}p{color:#c1ced7;line-height:1.55}.eyebrow{font-size:12px;letter-spacing:.15em;color:#d8c398}label{display:block;margin:22px 0 8px;font-weight:bold}input{width:100%;background:#111820;color:white;border:1px solid #687883;border-radius:10px;padding:14px;font-size:16px}button{width:100%;margin:14px 0;border:0;border-radius:10px;background:#dbc693;color:#17212a;padding:15px;font-size:16px;font-weight:bold;cursor:pointer}button:disabled{opacity:.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#111820;padding:15px;border-radius:10px;min-height:80px;line-height:1.7;font-size:13px}.small{font-size:13px}</style></head>
<body><main><div class="eyebrow">GRUPO CLIGED • HOMOLOGAÇÃO</div><h1>Autoteste do fluxo QR Code</h1><p>Teste sintético de abertura, reenvio sem duplicidade, gravação no D1, conclusão por link e auditoria. Sem TomTicket ou Google Chat.</p>
<label for="token">Segredo HML_WRITE_TOKEN</label><input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="Informe o token configurado no Cloudflare">
<button id="start">Executar teste completo</button><p id="status" role="status">Ainda não executado.</p><pre id="result">Aguardando teste.</pre>
<p class="small">O token é enviado somente ao Worker de homologação, nunca aparece no resultado nem é armazenado no navegador. Cada execução cria um registro fictício no D1 de homologação.</p></main>
<script>
const input=document.getElementById('token'),btn=document.getElementById('start'),status=document.getElementById('status'),out=document.getElementById('result');
btn.addEventListener('click',async()=>{
 const token=input.value;input.value='';
 if(token.length<32){status.textContent='O token deve ter ao menos 32 caracteres.';return;}
 btn.disabled=true;status.textContent='Executando teste de homologação...';out.textContent='Verificando.';
 try{
  const response=await fetch('/hml/autoteste',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}',cache:'no-store',referrerPolicy:'no-referrer'});
  const body=await response.json();
  status.textContent=response.ok?'Teste completo aprovado':'Teste incompleto';
  out.textContent='HTTP '+response.status+String.fromCharCode(10)+JSON.stringify(body,null,2);
 }catch{status.textContent='Erro de comunicação com o Worker HML.';out.textContent='Sem resultado.';}
 finally{btn.disabled=false;}
});
</script></body></html>`;