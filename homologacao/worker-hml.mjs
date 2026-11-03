// Entrada ISOLADA de homologação multiunidade.
// Esta versão não faz chamadas ao TomTicket nem ao Google Chat.
// Não substituir ../worker.js de produção sem homologação completa.
import catalogo from "./catalogo-unidades.json" with { type: "json" };
import { resolverLocal } from "./resolver-unidades.mjs";
import { htmlPainel } from "./painel-hml.mjs";
import { htmlSolicitante } from "./solicitante-original-hml.mjs";
import { htmlColaboradora } from "./colaboradora-original-hml.mjs";
import { reservarSimulacao } from "./reserva-hml.mjs";
import { auditarHml } from "./auditoria-hml.mjs";
import { linksConclusao } from './links-conclusao-hml.mjs';
import { htmlAtendimentoLink } from './atendimento-link-hml.mjs';
import { conclusaoRealClinica } from './conclusao-real-clinica-hml.mjs';
import { htmlAtendimentoReal } from './atendimento-real-page-hml.mjs';
import { simularCompleto } from './simulacao-completa-hml.mjs';
import { sessaoTeste } from './sessao-teste-hml.mjs';
import { autotesteHml } from './autoteste-hml.mjs';
import { gestaoHml } from './gestao-hml.mjs';
import { htmlGestao } from './gestao-page-hml.mjs';
import { preflightIntegracaoHml } from './integracao-preflight-hml.mjs';
import { pilotoExternoHml } from './piloto-externo-hml.mjs';
import { encerrarPilotoHml } from './encerramento-piloto-hml.mjs';
import { htmlSolicitanteLink } from './solicitante-link-hml.mjs';

const endpointsBloqueados = new Set(["/solicitacao", "/concluir", "/status", "/push/subscribe", "/push/test", "/debug/atendentes"]);

function resposta(request, env, dados, status = 200) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-CLIGED-Ambiente": "homologacao"
  });
  const origem = request.headers.get("Origin");
  const permitidos = new Set(["https://appgrupocliged.github.io"]);
  if (env?.HML_ALLOWED_ORIGIN) permitidos.add(env.HML_ALLOWED_ORIGIN);
  if (origem && permitidos.has(origem)) {
    headers.set("Access-Control-Allow-Origin", origem);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return new Response(JSON.stringify(dados), { status, headers });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/hml/gestao' && request.method === 'GET') {
      return new Response(htmlGestao,{status:200,headers:{
        'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
        'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
        'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }});
    }
    if (url.pathname === '/hml/atendimento-real' && request.method === 'GET') {
      return new Response(htmlAtendimentoReal,{headers:{
       'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
       'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow',
       'Content-Security-Policy':"default-src 'none'; img-src https://appgrupocliged.github.io; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
       'X-Content-Type-Options':'nosniff'
      }});
    }
    if (url.pathname.startsWith('/hml/real/links/')) return conclusaoRealClinica(request,env);
    if (url.pathname === '/hml/integracao/preflight') return preflightIntegracaoHml(request,env);
    if (url.pathname === '/hml/integracao/piloto') return pilotoExternoHml(request,env);
    if (url.pathname === '/hml/integracao/encerrar-piloto') return encerrarPilotoHml(request,env);
    if (url.pathname.startsWith('/hml/gestao/')) return gestaoHml(request,env);
    if (url.pathname === '/hml/autoteste') return autotesteHml(request,env);
    if (['/hml/testes/emitir','/hml/testes/sessao','/hml/testes/solicitar','/hml/testes/status'].includes(url.pathname)) return sessaoTeste(request,env);
    if (url.pathname === '/hml/solicitante' && request.method === 'GET') {
      return new Response(htmlSolicitanteLink, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src https://appgrupocliged.github.io; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
    }
    if (url.pathname === '/hml/simular') return simularCompleto(request,env);
    if (url.pathname === '/hml/atendimento' && request.method === 'GET') {
      return new Response(htmlAtendimentoLink, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src https://appgrupocliged.github.io; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
    }
    if (['/hml/links/emitir','/hml/links/consultar','/hml/links/concluir'].includes(url.pathname)) return linksConclusao(request,env);

    if (request.method === "OPTIONS") {
      const response = resposta(request, env, {}, 200);
      return new Response(null, { status: 204, headers: response.headers });
    }

    if (request.method === "GET" && (url.pathname === "/solicitante" || url.pathname === "/atendimento")) {
      const html = url.pathname === "/solicitante" ? htmlSolicitante : htmlColaboradora;
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "Content-Security-Policy": "default-src 'none'; img-src https://appgrupocliged.github.io; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/painel") {
      return new Response(htmlPainel(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return resposta(request, env, {
        status: "homologacao",
        mensagem: "API de validação de unidades — sem integração ativa com TomTicket",
        unidades: Object.keys(catalogo.units).length,
        locais: Object.values(catalogo.units).reduce((n, unidade) => n + Object.keys(unidade.locations).length, 0)
      });
    }

    // D1 HML: verificação somente de leitura do binding e do esquema.
    // Não lista dados dos chamados nem permite alterações no banco.
    if (request.method === "GET" && url.pathname === "/hml/db-health") {
      if (!env?.HML_DB || typeof env.HML_DB.prepare !== "function") {
        return resposta(request, env, {
          sucesso: false, ambiente: "homologacao", banco: "indisponivel"
        }, 503);
      }
      try {
        const result = await env.HML_DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('qr_requests', 'qr_events')"
        ).all();
        const names = new Set((result?.results || []).map(row => row.name));
        const schemaOk = names.has("qr_requests") && names.has("qr_events");
        return resposta(request, env, {
          sucesso: schemaOk,
          ambiente: "homologacao",
          banco: schemaOk ? "pronto" : "estrutura_incompleta",
          tabelas_necessarias: 2,
          tabelas_presentes: ["qr_requests", "qr_events"].filter(t => names.has(t)).length
        }, schemaOk ? 200 : 503);
      } catch {
        // Não expor SQL, erros internos ou dados do ambiente.
        return resposta(request, env, {
          sucesso: false, ambiente: "homologacao", banco: "falha_de_consulta"
        }, 503);
      }
    }

    // Diagnóstico estrutural de HML: valida as migrações 001–005 sem ler dados.
    if (request.method === "GET" && url.pathname === "/hml/readiness") {
      if (!env?.HML_DB || typeof env.HML_DB.prepare !== "function") {
        return resposta(request, env, {sucesso:false, ambiente:"homologacao", estado:"banco_indisponivel"}, 503);
      }
      try {
        const expectedTables = [
          "qr_requests", "qr_events", "hml_completion_links",
          "hml_test_sessions", "hml_test_requests", "hml_test_qr_locations"
        ];
        const expectedTriggers = ["qr_requests_audit_insert", "qr_requests_audit_state"];
        const found = await env.HML_DB.prepare(
          "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'trigger')"
        ).all();
        const objects = new Set((found?.results || []).map(v => v.type + ":" + v.name));
        const tablesOk = expectedTables.filter(name => objects.has("table:" + name)).length;
        const triggersOk = expectedTriggers.filter(name => objects.has("trigger:" + name)).length;
        const ready = tablesOk === expectedTables.length && triggersOk === expectedTriggers.length;
        return resposta(request, env, {
          sucesso:ready, ambiente:"homologacao",
          fluxo_simulado:ready ? "estrutura_pronta" : "migracoes_pendentes",
          tabelas_presentes:tablesOk, tabelas_necessarias:expectedTables.length,
          gatilhos_presentes:triggersOk, gatilhos_necessarios:expectedTriggers.length
        }, ready ? 200 : 503);
      } catch {
        return resposta(request, env, {sucesso:false, ambiente:"homologacao", estado:"verificacao_indisponivel"}, 503);
      }
    }

    if (request.method === "GET" && url.pathname === "/catalogo") {
      return resposta(request, env, {
        sucesso: true,
        unidade_padrao: catalogo.default_unit,
        unidades: Object.entries(catalogo.units).map(([codigo, unidade]) => ({
          codigo,
          nome: unidade.name,
          locais: Object.entries(unidade.locations).map(([local, nome]) => ({ codigo: local, nome }))
        }))
      });
    }

    if (request.method === "POST" && url.pathname === "/validar") {
      let body;
      try {
        body = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Corpo inválido.");
      } catch {
        return resposta(request, env, { sucesso: false, mensagem: "JSON inválido." }, 400);
      }
      try {
        const solicitado = body.unit_code ?? body.unidade;
        const local = resolverLocal(catalogo, {
          unit_code: solicitado,
          local_code: body.local_code ?? body.local
        });
        return resposta(request, env, { sucesso: true, local });
      } catch (error) {
        return resposta(request, env, { sucesso: false, mensagem: error.message }, 400);
      }
    }

    if (url.pathname === "/hml/auditar") return auditarHml(request, env);

    if (url.pathname === "/hml/reservar") {
      return reservarSimulacao(request, env);
    }

    // Bloqueio proposital: nunca ativar endpoints reais antes de autenticação,
    // idempotência, segregação de credenciais e testes integrados de homologação.
    if (endpointsBloqueados.has(url.pathname)) {
      return resposta(request, env, {
        sucesso: false,
        ambiente: "homologacao",
        mensagem: "Operação desabilitada até a homologação de segurança e integrações."
      }, 503);
    }

    return resposta(request, env, { sucesso: false, mensagem: "Rota não encontrada." }, 404);
  }
};
