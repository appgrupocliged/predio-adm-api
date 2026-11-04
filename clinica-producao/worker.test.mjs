import assert from 'node:assert/strict';
import worker from './worker.mjs';
const calls=[];
const env={CLIGED_AMBIENTE:'clinica-producao',HML_DB:{prepare(){throw Error('unexpected database call');}}};
async function get(path){return worker.fetch(new Request('https://cliged-qr-clinica.appgrupocliged.workers.dev'+path),env)}
const root=await get('/');
assert.equal(root.status,200);
assert.equal((await root.json()).locais,9);
const catalog=await get('/catalogo');
assert.equal((await catalog.json()).unidades[0].locais.length,9);
const codes=await get('/qr-codes.json');
const places=(await codes.json()).locais;
assert.equal(places.length,9);
assert.equal(new Set(places.map(v=>v.url)).size,9);
assert.ok(places.every(v=>v.url.startsWith('https://cliged-qr-clinica.appgrupocliged.workers.dev/clinica?')));
assert.ok(places.every(v=>v.svg.includes('<svg')));
assert.ok(places.every(v=>!v.url.includes('hml')&&!v.url.includes('predio-adm')));
const home=await get('/clinica?unidade=CLI-MCE&local=B.01'),html=await home.text();
assert.ok(html.includes('FAZER NOVA SOLICITAÇÃO'));
assert.ok(html.includes('STATUS DA SOLICITAÇÃO'));
assert.ok(!html.includes('🧪 HOMOLOGAÇÃO'));
const finish=await get('/concluir'),finishHtml=await finish.text();
assert.ok(!finishHtml.includes('CLÍNICA CLIGED — CONCLUSÃO REAL CONTROLADA'));
assert.ok(finishHtml.includes('O atendimento foi registrado com sucesso.'));
const post=await worker.fetch(new Request('https://cliged-qr-clinica.appgrupocliged.workers.dev/hml/clinica/solicitar',
 {method:'POST',body:'{}'}),env);
assert.equal(post.status,423);
assert.equal((await post.json()).estado,'DESATIVADO');
console.log('PASS: Worker Clinica isolado, QR fixos, UI original, conclusao limpa e bloqueio inicial');
