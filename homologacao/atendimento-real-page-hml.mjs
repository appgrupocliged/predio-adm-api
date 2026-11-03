import {htmlColaboradora} from './colaboradora-original-hml.mjs';
// Tela separada, sem reutilizar o link da simulacao nem expor token administrativo.
const script=String.raw`<script>
(()=>{'use strict';
const token=new URLSearchParams(location.hash.slice(1)).get('chave')||'';
history.replaceState(null,'',location.pathname);
const info=document.getElementById('info'),card=document.getElementById('card'),
 btn=document.getElementById('concluir'),input=document.getElementById('nome');
const note=card.querySelector('.note');
note.textContent='A conclusao real so funciona com a liberacao especifica do ambiente da Clinica.';
input.maxLength=100;
async function post(path,body){const r=await fetch('/hml/real/links/'+path,{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer'});
 const d=await r.json();if(!r.ok)throw Error(d.mensagem||('HTTP '+r.status));return d;}
function fail(t){info.textContent=t;btn.disabled=true;}
if(!token){fail('Use o link de conclusao fornecido pela administracao.');return;}
post('consultar',{token}).then(d=>{info.textContent=d.local+'\nServicos: '+d.itens.join(', ');info.style.whiteSpace='pre-line';btn.disabled=false;})
 .catch(e=>fail(e.message));
let sent=false;
btn.addEventListener('click',async()=>{
 if(sent)return;
 const nome=input.value.trim();if(nome.length<2||nome.length>100){info.textContent='Informe o nome da colaboradora.';return;}
 sent=true;btn.disabled=true;info.textContent='Registrando a conclusao. Nao clique novamente.';
 try{const d=await post('concluir',{token,nome});card.style.display='none';
 document.getElementById('success').style.display='block';
 document.getElementById('successMessage').textContent='Chamado '+d.ticket_id+' concluido no TomTicket e notificado no Google Chat.';}
 catch(e){info.textContent='Resultado nao confirmado: '+e.message+' Nao repita o envio. Avise a administracao.';}
});
})();
</script>`;
export const htmlAtendimentoReal=htmlColaboradora
 .replace('🧪 HOMOLOGAÇÃO — SEM CONCLUSÃO DE CHAMADOS REAIS','CLÍNICA CLIGED — CONCLUSÃO REAL CONTROLADA')
 .replace(/<script>[\s\S]*?<\/script>/,()=>script);
