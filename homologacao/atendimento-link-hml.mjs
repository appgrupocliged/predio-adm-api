import {htmlColaboradora} from './colaboradora-original-hml.mjs';
// Deriva uma tela HML separada; preserva o arquivo original e seu visual.
const script=String.raw`<script>
(()=>{'use strict';
const token=new URLSearchParams(location.hash.slice(1)).get('chave')||'';
history.replaceState(null,'',location.pathname);
const info=document.getElementById('info'),card=document.getElementById('card'),btn=document.getElementById('concluir'),input=document.getElementById('nome');
input.maxLength=100;
const note=card.querySelector('.note');note.textContent='Homologação: preencha seu nome. Nenhum chamado real será encerrado.';
function fail(text){info.textContent=text;btn.disabled=true;}
async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.mensagem||'Não foi possível continuar.');return d;}
btn.addEventListener('click',async()=>{if(input.value.trim().length<2){info.textContent='Informe seu nome para concluir.';return;}btn.disabled=true;
try{await post('/hml/links/concluir',{token,nome:input.value.trim()});card.style.display='none';document.getElementById('success').style.display='block';document.getElementById('successMessage').textContent='Atendimento registrado na homologação. Nenhum chamado real foi encerrado.';}
catch(e){info.textContent=e.message;btn.disabled=false;}});
if(!token){fail('Abra o link completo encaminhado para esta solicitação.');return;}
post('/hml/links/consultar',{token}).then(d=>{info.textContent='Unidade: '+d.unidade+' · Local: '+d.local+'\nItens: '+d.itens.join(', ');info.style.whiteSpace='pre-line';
if(d.estado!=='ABERTA'){fail(d.estado==='CONCLUIDA'?'Esta solicitação já foi concluída.':'Solicitação indisponível para conclusão.');return;}btn.disabled=false;}).catch(e=>fail(e.message));
})();
</script>`;
export const htmlAtendimentoLink=htmlColaboradora.replace(/<script>[\s\S]*?<\/script>/,()=>script);
