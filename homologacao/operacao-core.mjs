// Regras de negócio multiunidade — módulo isolado, sem chamadas externas.
// Só integrar ao TomTicket após persistência idempotente e autenticação verificadas.
import { resolverLocal } from "./resolver-unidades.mjs";

export const SERVICOS_PERMITIDOS = Object.freeze([
  "Papel higiênico",
  "Papel toalha",
  "Sabonete líquido",
  "Troca/retirada de lixo",
  "limpeza"
]);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

export async function prepararSolicitacao(catalogo, pedido) {
  if (!pedido || typeof pedido !== "object" || Array.isArray(pedido)) {
    throw erro("PAYLOAD_INVALIDO", "Solicitação inválida.");
  }
  const chave = pedido.idempotency_key;
  if (typeof chave !== "string" || !UUID_V4.test(chave)) {
    throw erro("CHAVE_INVALIDA", "Identificador de envio inválido.");
  }
  const local = resolverLocal(catalogo, {
    unit_code: pedido.unit_code,
    local_code: pedido.local_code
  });
  if (!Array.isArray(pedido.items) || pedido.items.length < 1 || pedido.items.length > 5) {
    throw erro("SERVICOS_INVALIDOS", "Selecione entre 1 e 5 serviços.");
  }
  const items = pedido.items;
  if (items.some(item => typeof item !== "string" || !SERVICOS_PERMITIDOS.includes(item)) ||
      new Set(items).size !== items.length) {
    throw erro("SERVICOS_INVALIDOS", "Serviço desconhecido ou repetido.");
  }
  // Ordem canônica: reenvios com as mesmas opções têm o mesmo fingerprint.
  const servicos = SERVICOS_PERMITIDOS.filter(item => items.includes(item));
  const assunto = local.unit_code === "ADM-MCE"
    ? "Solicitação - " + local.local_name
    : "Solicitação - " + local.unit_name + " - " + local.local_code + " - " + local.local_name;
  const mensagem = [
    "Unidade: " + local.unit_name + " (" + local.unit_code + ")",
    "Código do local: " + local.local_code,
    "Local: " + local.local_name,
    "",
    "Solicitação:",
    ...servicos.map(item => "- " + (item === "limpeza" ? "Solicitar limpeza" : item))
  ].join("\n");
  // Persistir no banco o fingerprint e a chave única para impedir reenvio duplicado.
  const canonical = JSON.stringify({
    location_id: local.location_id,
    servicos,
    categoria: "52d32a3af1d7fd87c277f7aec520b38b",
    prioridade: "2"
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const fingerprint = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  return Object.freeze({
    idempotency_key: chave.toLowerCase(),
    fingerprint,
    unit_code: local.unit_code,
    unit_name: local.unit_name,
    local_code: local.local_code,
    local_name: local.local_name,
    location_id: local.location_id,
    legacy_link: local.legacy_link,
    servicos,
    assunto,
    mensagem,
    categoria: "52d32a3af1d7fd87c277f7aec520b38b",
    prioridade: "2"
  });
}

// A autorização abaixo NÃO verifica JWT: recebe APENAS identidade já
// autenticada e autorizada pelo adaptador Cloudflare Access.
// Nunca derive principal diretamente de JSON ou headers enviados pelo usuário.
export function autorizarConclusao(registro, solicitacao, principal) {
  if (!principal || principal.accessJwtVerified !== true ||
      principal.policyAllowed !== true || typeof principal.subject !== "string" ||
      principal.subject.length < 3) {
    throw erro("NAO_AUTORIZADO", "Colaboradora não autenticada.");
  }
  if (!registro || registro.status !== "ABERTO" ||
      typeof registro.ticket_id !== "string" || !registro.ticket_id) {
    throw erro("CHAMADO_NAO_ABERTO", "Chamado indisponível para conclusão.");
  }
  if (!solicitacao || String(solicitacao.ticket_id ?? "") !== registro.ticket_id ||
      String(solicitacao.unit_code ?? "") !== registro.unit_code ||
      String(solicitacao.local_code ?? "") !== registro.local_code) {
    throw erro("IDENTIDADE_DIVERGENTE", "Os dados não correspondem ao chamado registrado.");
  }
  return Object.freeze({
    ticket_id: registro.ticket_id,
    unit_code: registro.unit_code,
    local_code: registro.local_code,
    location_id: registro.unit_code + ":" + registro.local_code,
    actor: principal.subject
  });
}
