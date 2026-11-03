// Pré-validação da integração HML. Nenhum fetch externo é executado.
// A emissão de chamados reais exige credenciais próprias e liberação explícita
// em outra etapa; manter TomTicket/Google Chat inteiramente bloqueados aqui.
import catalogo from './catalogo-unidades.json' with {type:'json'};
import {prepararSolicitacao} from './operacao-core.mjs';
import {prepararPlanoIntegracao} from './planos-integracao-hml.mjs';
import {tokenValido} from './reserva-hml.mjs';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow'
}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function preflightIntegracaoHml(request,env={}){
  if(request.method!=='POST')return json({sucesso:false,mensagem:'Método não permitido.'},405);
  if(env.CLIGED_AMBIENTE!=='homologacao'||!env.HML_DB?.prepare||!env.HML_WRITE_TOKEN)
    return json({sucesso:false,mensagem:'Homologação indisponível.'},503);
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||!await tokenValido(auth.slice(7),env.HML_WRITE_TOKEN))
    return json({sucesso:false,mensagem:'Não autorizado.'},401);
  let key;
  try{
    const raw=await request.text();
    if(raw.length>512)throw Error('large');
    const body=JSON.parse(raw);
    if(!body||Object.keys(body).length!==1||typeof body.idempotency_key!=='string'||!UUID.test(body.idempotency_key))
      throw Error('invalid');
    key=body.idempotency_key.toLowerCase();
  }catch{return json({sucesso:false,mensagem:'Identificador inválido.'},400);}
  try{
    const registro=await env.HML_DB.prepare(
      "SELECT idempotency_key,fingerprint,unit_code,local_code,location_id,items_json,state,ticket_id FROM qr_requests WHERE idempotency_key=?"
    ).bind(key).first();
    if(!registro||registro.unit_code!=='CLI-MCE'||
       registro.location_id!=='CLI-MCE:'+registro.local_code||
       !['ABERTA','CONCLUIDA'].includes(registro.state)||
       registro.ticket_id!=='SIM-'+key)
      return json({sucesso:false,mensagem:'Somente chamados simulados da Clínica podem ser pré-validados.'},409);
    const itens=JSON.parse(registro.items_json);
    const pedido=await prepararSolicitacao(catalogo,{
      idempotency_key:key,unit_code:registro.unit_code,
      local_code:registro.local_code,items:itens
    });
    if(registro.fingerprint!==pedido.fingerprint)
      return json({sucesso:false,mensagem:'Registro diverge do catálogo validado.'},409);
    // Configurações de referência pertencentes ao fluxo já aprovado do prédio ADM.
    // SOMENTE plano simulado: o módulo nunca chama qualquer API externa.
    const plan=prepararPlanoIntegracao(pedido,{
      customer_id:'appgrupocliged@gmail.com',
      department_id:'2d507dafee35b29d9e5852d9b0c4ce2c',
      operator_id:'f2993967f0eaaa58f72ad1d95c7333fd',
      ticket_id_simulado:'SIM-'+key,
      concluir_url:'https://cliged-qr-hml-isolado.appgrupocliged.workers.dev/hml/atendimento'
    });
    const create=new URLSearchParams(plan.passos[0].body);
    const reply=new URLSearchParams(plan.passos[2].body);
    const expectedFields=['customer_id','customer_id_type','department_id',
      'category_id','subject','message','priority'];
    if(expectedFields.some(f=>!create.has(f))||pedido.location_id!==plan.location_id)
      return json({sucesso:false,mensagem:'Contrato de criação incompleto.'},503);
    return json({
      sucesso:true,ambiente:'homologacao',modo:'SIMULACAO_SEM_REDE',
      status:'CONTRATOS_VALIDADOS',
      location_id:pedido.location_id,estado:registro.state,
      chamada_externa_realizada:false,
      validacoes:[
        {etapa:'criar',metodo:'POST',rota:'/v2.0/ticket/new',
          subject:create.get('subject'),campos:expectedFields, valido:true},
        {etapa:'vincular_gleice',metodo:'POST',rota:'/v2.0/ticket/transfer',
          campos:['ticket_id','operator_id'],valido:true},
        {etapa:'inserir_link',metodo:'POST',rota:'/v2.0/ticket/reply/customer',
          campos:[...reply.keys()],valido:true},
        {etapa:'notificar_chat',metodo:'POST',rota:'GOOGLE_CHAT_WEBHOOK',
          campos:['text'],valido:true}
      ],
      observacao:'Link e identificador são sintéticos. Nenhum chamado foi criado ou alterado no TomTicket ou Google Chat.',
      pendencias_para_integracao_real:[
        'credenciais dedicadas a teste, distintas das de produção',
        'autenticação da colaboradora e reconciliação de chamadas incertas',
        'autorização explícita para criar um chamado externo de teste'
      ]
    });
  }catch{
    return json({sucesso:false,mensagem:'Não foi possível validar o contrato. Nenhuma chamada externa foi realizada.'},503);
  }
}
