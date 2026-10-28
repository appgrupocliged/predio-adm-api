// Entrada ISOLADA de homologação multiunidade.
// Esta versão não faz chamadas ao TomTicket nem ao Google Chat.
// Não substituir ../worker.js de produção sem homologação completa.
import catalogo from "./catalogo-unidades.json" with { type: "json" };
import { resolverLocal } from "./resolver-unidades.mjs";
import { htmlPainel } from "./painel-hml.mjs";

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

    if (request.method === "OPTIONS") {
      const response = resposta(request, env, {}, 200);
      return new Response(null, { status: 204, headers: response.headers });
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
