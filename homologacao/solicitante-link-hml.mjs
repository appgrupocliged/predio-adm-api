import {htmlSolicitante} from './solicitante-original-hml.mjs';
const script=String.raw`<script>
(()=>{'use strict';
const token=new URLSearchParams(location.hash.slice(1)).get('sessao')||'';
history.replaceState(null,'',location.pathname+location.search);
const form=document.getElementById('form'),success=document.getElementById('success'),unit=document.getElementById('unidade'),local=document.getElementById('local'),button=document.getElementById('send'),newRequest=document.getElementById('newRequest'),summary=document.getElementById('summary'),status=document.getElementById('statusValue'),date=document.getElementById('statusDate'),localCode=document.getElementById('localCode'),boxes=[...document.querySelectorAll('.options input[type="checkbox"]')];
let catalog=[],ready=false,busy=false,pending=null,statusTimer=null,completionToken=null,statusBusy=false;
const params=new URLSearchParams(location.search),qr=params.has('local'),requestedUnit=params.get('unidade')||params.get('unit_code')||(qr?'ADM-MCE':'CLI-MCE');
const requestedLocal=(params.get('local')||'').trim().toUpperCase();
const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='color:#f1e7a8;line-height:1.5';form.appendChild(notice);
async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.mensagem||'Não foi possível continuar.');return d;}
async function refreshStatus(){if(!completionToken||statusBusy)return;statusBusy=true;try{const d=await post('/hml/links/consultar',{token:completionToken});if(d.estado==='CONCLUIDA'){status.textContent='Atendimento concluído na homologação';date.textContent='A conclusão foi registrada. Nenhum chamado real foi encerrado.';clearInterval(statusTimer);statusTimer=null;}}catch{date.textContent='Não foi possível atualizar o status agora. A solicitação já está registrada.';}finally{statusBusy=false;}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStatus();});
function add(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o);}
function update(){const u=catalog.find(x=>x.codigo===unit.value),p=u?.locais.find(x=>x.codigo===local.value);localCode.style.display='block';localCode.textContent=p?u.nome+' · '+p.codigo+' — '+p.nome:'';button.disabled=!ready||busy||(!pending&&(!p||!boxes.some(x=>x.checked)));unit.disabled=!ready||qr||busy||!!pending;local.disabled=!ready||qr||busy||!!pending;boxes.forEach(x=>x.disabled=!ready||busy||!!pending);}
function reload(){local.replaceChildren();const u=catalog.find(x=>x.codigo===unit.value);if(u)for(const p of u.locais)add(local,p.codigo,p.codigo+' — '+p.nome);if(qr)local.value=requestedLocal;update();}
unit.addEventListener('change',reload);local.addEventListener('change',update);boxes.forEach(x=>x.addEventListener('change',update));
button.addEventListener('click',async()=>{if(!ready||busy)return;busy=true;
if(!pending)pending={idempotency_key:crypto.randomUUID(),unit_code:unit.value,local_code:local.value,items:boxes.filter(x=>x.checked).map(x=>x.value)};update();notice.textContent='Registrando solicitação de teste…';
try{const d=await post('/hml/testes/solicitar',{token,pedido:pending});summary.replaceChildren();summary.append(document.createTextNode('Local: '+d.location_id),document.createElement('br'),document.createTextNode('Itens: '+pending.items.join(', ')));
const a=document.createElement('a');a.href=d.link_conclusao;a.textContent='ABRIR LINK DE CONCLUSÃO';a.style.cssText='display:block;margin-top:20px;color:#f1e7a8;font-weight:800';summary.appendChild(a);
const copy=document.createElement('button');copy.type='button';copy.textContent='COPIAR LINK PARA ENCAMINHAR';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(d.link_conclusao);copy.textContent='LINK COPIADO';}catch{copy.textContent='Toque e segure no link acima para copiá-lo';}});summary.appendChild(copy);
const h=success.querySelector('h2');if(h)h.textContent='Solicitação de teste registrada!';status.textContent='Aguardando conclusão na homologação';date.textContent='O link pode ser encaminhado para a colaboradora. Nenhum chamado real foi criado.';completionToken=new URLSearchParams(new URL(d.link_conclusao).hash.slice(1)).get('chave');clearInterval(statusTimer);statusTimer=setInterval(()=>{if(!document.hidden)refreshStatus();},10000);form.style.display='none';success.style.display='block';
}catch(e){notice.textContent=e.message+' Use o botão para reenviar a mesma solicitação.';button.textContent='REENVIAR SOLICITAÇÃO DE TESTE';}
finally{busy=false;update();}});
newRequest.addEventListener('click',()=>{clearInterval(statusTimer);statusTimer=null;completionToken=null;pending=null;boxes.forEach(x=>x.checked=false);button.textContent='ENVIAR SOLICITAÇÃO DE TESTE';notice.textContent='';form.style.display='block';success.style.display='none';update();});
button.textContent='ENVIAR SOLICITAÇÃO DE TESTE';update();
if(!token){notice.textContent='Abra o link de acesso de teste fornecido para esta homologação.';return;}
Promise.all([post('/hml/testes/sessao',{token}),fetch('/catalogo',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catálogo indisponível.');return r.json();})]).then(([session,c])=>{catalog=c.unidades;unit.replaceChildren();for(const u of catalog)add(unit,u.codigo,u.nome);unit.value=requestedUnit;const u=catalog.find(x=>x.codigo===requestedUnit);if(!u||qr&&!u.locais.some(p=>p.codigo===requestedLocal))throw Error('Unidade ou local do link inválido.');ready=session.restantes>0;reload();notice.textContent=ready?'Acesso temporário de homologação. Escolha o local e os serviços.':'Limite de solicitações de teste atingido.';}).catch(e=>{notice.textContent=e.message;ready=false;update();});
})();
</script>`;
export const htmlSolicitanteLink=htmlSolicitante.replace(/<script>[\s\S]*?<\/script>/,()=>script);
