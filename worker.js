// ============================================================
// WORKER - Sistema de Solicitações via QR Code (Grupo CLIGED)
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://appgrupocliged.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=UTF-8"
};

// ============================================================
// MAPA OFICIAL DOS QR CODES
// ============================================================

const LOCAIS_QR = {
  "B.01": "DIRETORIA",
  "B.02": "CORREDOR AUTORIZAÇÃO",
  "B.03": "FINANCEIRO",
  "B.04": "RH",
  "B.05": "COMPRAS",
  "B.06": "ESTOQUE",
  "B.07": "ESTOQUE",
  "B.08": "CONTROLADORIA",
  "B.09": "COWORKING",
  "B.10": "CORREDOR REUNIÃO",
  "B.11": "D.P",
  "B.12": "CORREDOR CALL CENTER",
  "B.13": "COMFORT ADM",
  "B.14": "T.I",
  "B.15": "CTA ADM",
  "B.16": "MARKETING / INFRAESTRUTURA",
  "B.17": "FATURAMENTO",
  "B.18": "AUDITORIA",
  "B.19": "QUALIDADE"
};

// ============================================================
// CONFIGURAÇÕES FIXAS
// ============================================================

const DEPARTMENT_ID = "2d507dafee35b29d9e5852d9b0c4ce2c";
const GLEICE_OPERATOR_ID = "f2993967f0eaaa58f72ad1d95c7333fd";

// ============================================================
// URL DO CONCLUIR.HTML
// ============================================================

const CONCLUIR_URL = "https://appgrupocliged.github.io/predio-adm/concluir.html";

// ============================================================
// CLIENTE TOMTICKET
// ============================================================

const CUSTOMER_ID = "appgrupocliged@gmail.com";
const CUSTOMER_ID_TYPE = "E";

// ============================================================
// HELPERS
// ============================================================

function respostaJSON(dados, status = 200) {
  return new Response(JSON.stringify(dados, null, 2), {
    status,
    headers: CORS_HEADERS
  });
}

async function parseRespostaTomTicket(resposta) {
  const texto = await resposta.text();
  try {
    return { dados: JSON.parse(texto), texto };
  } catch {
    return { dados: { resposta: texto }, texto };
  }
}

function tomTicketFalhou(resposta, dados) {
  return (
    !resposta.ok ||
    dados.error === true ||
    dados.success === false
  );
}

async function notificarGoogleChat(env, texto) {
  if (!env.GOOGLE_CHAT_WEBHOOK_URL) return;

  try {
    const resposta = await fetch(env.GOOGLE_CHAT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text: texto })
    });

    console.log("Status Google Chat:", resposta.status);
  } catch (error) {
    console.error("ERRO AO ENVIAR NOTIFICAÇÃO GOOGLE CHAT:", error);
  }
}

// ============================================================
// WORKER
// ============================================================

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ====================================================
    // GET / - TESTE DA API
    // ====================================================

    if (request.method === "GET" && url.pathname === "/") {
      return respostaJSON({
        status: "online",
        mensagem: "API do sistema de solicitações funcionando",
        locais_qr: Object.keys(LOCAIS_QR).length
      });
    }

    // ====================================================
    // GET /debug/atendentes - LISTA ATENDENTES DO DEPARTAMENTO
    // (rota temporária, só para confirmar operator_id - remover depois)
    // ====================================================

    if (request.method === "GET" && url.pathname === "/debug/atendentes") {
      try {
        if (!env.TOMTICKET_TOKEN) {
          return respostaJSON(
            { sucesso: false, mensagem: "Token do TomTicket não configurado na API." },
            500
          );
        }

        const departamento =
          url.searchParams.get("department_id") || DEPARTMENT_ID;

        const respostaAtendentes = await fetch(
          "https://api.tomticket.com/v2.0/department/operator/list?department_id=" +
          encodeURIComponent(departamento),
          {
            headers: {
              "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`,
              "Accept": "application/json"
            }
          }
        );

        const { dados } = await parseRespostaTomTicket(respostaAtendentes);

        return respostaJSON({
          sucesso: !tomTicketFalhou(respostaAtendentes, dados),
          department_id: departamento,
          status_tomticket: respostaAtendentes.status,
          resposta_tomticket: dados
        });
      } catch (error) {
        return respostaJSON(
          { sucesso: false, mensagem: "Erro ao consultar atendentes.", erro: error.message },
          500
        );
      }
    }

    // ====================================================
    // GET /status - CONSULTA STATUS DO CHAMADO
    // ====================================================

    if (request.method === "GET" && url.pathname === "/status") {
      try {
        const ticket_id = String(url.searchParams.get("id") || "").trim();

        if (!ticket_id) {
          return respostaJSON(
            { sucesso: false, mensagem: "ID do chamado não informado." },
            400
          );
        }

        if (!env.TOMTICKET_TOKEN) {
          console.error("TOMTICKET_TOKEN não configurado.");
          return respostaJSON(
            { sucesso: false, mensagem: "Token do TomTicket não configurado na API." },
            500
          );
        }

        const urlTomTicket =
          "https://api.tomticket.com/v2.0/ticket/detail?ticket_id=" +
          encodeURIComponent(ticket_id);

        const respostaStatus = await fetch(urlTomTicket, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`,
            "Accept": "application/json"
          }
        });

        const { dados: dadosStatus } = await parseRespostaTomTicket(respostaStatus);

        if (tomTicketFalhou(respostaStatus, dadosStatus)) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "consulta_status",
              mensagem: "Não foi possível consultar o chamado no TomTicket.",
              ticket_id,
              status_tomticket: respostaStatus.status,
              resposta_tomticket: dadosStatus
            },
            respostaStatus.status >= 400 ? respostaStatus.status : 500
          );
        }

        const dados = dadosStatus.data || dadosStatus;

        // --------------------------------------------------
        // Extração do status (current_status > status > situation)
        // --------------------------------------------------

        let statusObjeto = dados.current_status || null;

        if (!statusObjeto && dados.status && !Array.isArray(dados.status)) {
          statusObjeto = dados.status;
        }

        if (!statusObjeto && dados.situation) {
          statusObjeto = dados.situation;
        }

        let status = null;
        let statusId = null;
        let statusApplyDate = null;

        if (typeof statusObjeto === "string") {
          status = statusObjeto;
        } else if (statusObjeto && typeof statusObjeto === "object") {
          status = statusObjeto.description || statusObjeto.name || statusObjeto.status || null;
          statusId = statusObjeto.id || null;
          statusApplyDate = statusObjeto.apply_date || null;
        }

        if (!status && Array.isArray(dados.status) && dados.status.length > 0) {
          const ultimo = dados.status[dados.status.length - 1];
          if (ultimo) {
            status = ultimo.description || ultimo.name || ultimo.status || null;
            statusId = ultimo.id || null;
            statusApplyDate = ultimo.apply_date || null;
          }
        }

        const situacao = dados.situation || null;
        let situationId = null;
        let situationDescription = null;
        let situationApplyDate = null;

        if (situacao && typeof situacao === "object") {
          situationId = situacao.id || null;
          situationDescription = situacao.description || null;
          situationApplyDate = situacao.apply_date || null;
        }

        if (!status && situationDescription) status = situationDescription;
        if (!statusId && situationId) statusId = situationId;
        if (!statusApplyDate && situationApplyDate) statusApplyDate = situationApplyDate;

        return respostaJSON({
          sucesso: true,
          ticket_id,
          protocol: dados.protocol || null,
          status,
          status_id: statusId,
          status_apply_date: statusApplyDate,
          situation_id: situationId,
          situation: situationDescription,
          situation_apply_date: situationApplyDate,
          subject: dados.subject || null,
          current_status: dados.current_status || null,
          data: dados
        });
      } catch (error) {
        console.error("ERRO AO CONSULTAR STATUS:", error);
        return respostaJSON(
          {
            sucesso: false,
            etapa: "status",
            mensagem: "Erro interno ao consultar o status do chamado.",
            erro: error.message
          },
          500
        );
      }
    }

    // ====================================================
    // POST /solicitacao - CRIAÇÃO DO CHAMADO
    // ====================================================

    if (request.method === "POST" && url.pathname === "/solicitacao") {
      try {
        const body = await request.json();
        const { local_code, category_id, message, priority } = body;

        if (!local_code) {
          return respostaJSON(
            { sucesso: false, mensagem: "Código do local não informado." },
            400
          );
        }

        const codigo = String(local_code).toUpperCase().trim();
        const local = LOCAIS_QR[codigo];

        if (!local) {
          return respostaJSON(
            { sucesso: false, mensagem: "Código de local inválido.", codigo_recebido: codigo },
            400
          );
        }

        if (!category_id || !message) {
          return respostaJSON(
            {
              sucesso: false,
              mensagem: "Dados obrigatórios não informados.",
              diagnostico: {
                local_code: codigo,
                category_id_recebido: !!category_id,
                message_recebido: !!message
              }
            },
            400
          );
        }

        if (!env.TOMTICKET_TOKEN) {
          console.error("TOMTICKET_TOKEN não configurado.");
          return respostaJSON(
            { sucesso: false, mensagem: "Token do TomTicket não configurado na API." },
            500
          );
        }

        const assuntoOficial = "Solicitação - " + local;

        let mensagemRecebida = String(message)
          .replace(/\\n/g, "\n")
          .replace(/^Local:.*\n*/i, "");

        const mensagemOficial =
          "Código do local: " + codigo + "\n" +
          "Local: " + local + "\n\n" +
          mensagemRecebida;

        // --------------------------------------------------
        // Criação do chamado (department_id já define o
        // departamento - o TomTicket cai automaticamente na
        // fila "Novos Chamados" desse departamento, sem
        // precisar de uma transferência posterior)
        // --------------------------------------------------

        const dadosCriar = new URLSearchParams();
        dadosCriar.append("customer_id", CUSTOMER_ID);
        dadosCriar.append("customer_id_type", CUSTOMER_ID_TYPE);
        dadosCriar.append("department_id", DEPARTMENT_ID);
        dadosCriar.append("category_id", String(category_id));
        dadosCriar.append("subject", assuntoOficial);
        dadosCriar.append("message", mensagemOficial);
        dadosCriar.append("priority", String(priority || "2"));

        const respostaCriacao = await fetch("https://api.tomticket.com/v2.0/ticket/new", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`
          },
          body: dadosCriar.toString()
        });

        const { dados: dadosCriacao } = await parseRespostaTomTicket(respostaCriacao);

        if (tomTicketFalhou(respostaCriacao, dadosCriacao)) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "criacao",
              mensagem: "Erro ao criar chamado no TomTicket.",
              status_tomticket: respostaCriacao.status,
              resposta_tomticket: dadosCriacao
            },
            500
          );
        }

        const ticket_id =
          dadosCriacao.ticket_id ||
          dadosCriacao.id ||
          dadosCriacao.data?.ticket_id ||
          dadosCriacao.data?.id;

        if (!ticket_id) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "criacao",
              mensagem: "Chamado criado, mas o TomTicket não retornou o ticket_id.",
              tomticket: dadosCriacao
            },
            500
          );
        }

        // --------------------------------------------------
        // VÍNCULO DA ATENDENTE (Gleice)
        // Só operator_id - mandar department_id junto é
        // rejeitado como "Same department" pelo TomTicket,
        // já que o chamado já nasce nesse departamento.
        // Se a distribuição automática do TomTicket já colocou
        // a Gleice, a API recusa com "Same operator" - isso NÃO
        // é erro real, o resultado já é o esperado.
        // --------------------------------------------------

        const dadosVinculo = new FormData();
        dadosVinculo.append("ticket_id", String(ticket_id));
        dadosVinculo.append("operator_id", GLEICE_OPERATOR_ID);

        const respostaVinculo = await fetch("https://api.tomticket.com/v2.0/ticket/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`
          },
          body: dadosVinculo
        });

        const { dados: dadosVinculoResultado } = await parseRespostaTomTicket(respostaVinculo);

        const jaEstaComGleice =
          typeof dadosVinculoResultado.message === "string" &&
          dadosVinculoResultado.message.toLowerCase().includes("same operator");

        if (!jaEstaComGleice && tomTicketFalhou(respostaVinculo, dadosVinculoResultado)) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "vinculo_atendente",
              mensagem: "Chamado criado, mas não foi possível vincular a atendente responsável.",
              chamado_criado: true,
              ticket_id,
              local_code: codigo,
              local,
              resposta_tomticket: dadosVinculoResultado
            },
            500
          );
        }

        // --------------------------------------------------
        // Link de conclusão (id + local, como concluir.html espera)
        // --------------------------------------------------

        const linkConclusao =
          CONCLUIR_URL +
          "?id=" + encodeURIComponent(String(ticket_id)) +
          "&local=" + encodeURIComponent(codigo);

        const dadosLink = new URLSearchParams();
        dadosLink.append("ticket_id", String(ticket_id));
        dadosLink.append("message", "🔗 CONCLUIR SOLICITAÇÃO:\n\n" + linkConclusao);

        const respostaLink = await fetch("https://api.tomticket.com/v2.0/ticket/reply/customer", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`
          },
          body: dadosLink.toString()
        });

        const { dados: dadosLinkResultado } = await parseRespostaTomTicket(respostaLink);

        if (tomTicketFalhou(respostaLink, dadosLinkResultado)) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "link_conclusao",
              mensagem: "Chamado criado, mas não foi possível inserir o link de conclusão.",
              chamado_criado: true,
              ticket_id,
              local_code: codigo,
              local,
              link_conclusao: linkConclusao,
              resposta_tomticket: dadosLinkResultado
            },
            500
          );
        }

        // --------------------------------------------------
        // NOTIFICAÇÃO GOOGLE CHAT
        // --------------------------------------------------

        await notificarGoogleChat(
          env,
          "🚨 NOVA SOLICITAÇÃO\n\n" +
          "📍 Local: " + codigo + " — " + local + "\n" +
          mensagemRecebida +
          "\n\n🔗 Concluir solicitação:\n" + linkConclusao
        );

        // --------------------------------------------------
        // SUCESSO
        // --------------------------------------------------

        return respostaJSON({
          sucesso: true,
          mensagem: "Chamado criado, vinculado à atendente e link de conclusão inserido com sucesso.",
          ticket_id,
          local_code: codigo,
          local,
          subject: assuntoOficial,
          link_conclusao: linkConclusao,
          department_id: DEPARTMENT_ID,
          operator_id: GLEICE_OPERATOR_ID,
          criacao: dadosCriacao,
          vinculo: dadosVinculoResultado,
          link: dadosLinkResultado
        });
      } catch (error) {
        console.error("ERRO NA API:", error);
        return respostaJSON(
          {
            sucesso: false,
            etapa: "worker",
            mensagem: "Erro interno ao processar a solicitação.",
            erro: error.message
          },
          500
        );
      }
    }

    // ====================================================
    // POST /concluir - CONCLUSÃO DA SOLICITAÇÃO
    // ====================================================

    if (request.method === "POST" && url.pathname === "/concluir") {
      try {
        const body = await request.json();
        const ticket_id = String(body.ticket_id || "").trim();
        const nome = String(body.nome || "").trim();
        const local_code = String(body.local_code || "").trim();

        if (!ticket_id) {
          return respostaJSON(
            { sucesso: false, mensagem: "ID do chamado não informado." },
            400
          );
        }

        if (nome.length < 2) {
          return respostaJSON(
            { sucesso: false, mensagem: "Nome da colaboradora não informado." },
            400
          );
        }

        if (!env.TOMTICKET_TOKEN) {
          console.error("TOMTICKET_TOKEN não configurado.");
          return respostaJSON(
            { sucesso: false, mensagem: "Token do TomTicket não configurado na API." },
            500
          );
        }

        const mensagem = "Solicitação concluída.\n\nRealizado por: " + nome;

        // --------------------------------------------------
        // Finaliza o chamado de verdade no TomTicket
        // (/ticket/finish, não /ticket/reply/customer)
        // --------------------------------------------------

        const dados = new URLSearchParams();
        dados.append("ticket_id", ticket_id);
        dados.append("message", mensagem);

        const resposta = await fetch("https://api.tomticket.com/v2.0/ticket/finish", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${env.TOMTICKET_TOKEN}`
          },
          body: dados.toString()
        });

        const { dados: resultado, texto } = await parseRespostaTomTicket(resposta);

        if (tomTicketFalhou(resposta, resultado)) {
          return respostaJSON(
            {
              sucesso: false,
              etapa: "finalizacao_tomticket",
              mensagem: "TomTicket recusou a finalização do chamado.",
              ticket_id,
              status_tomticket: resposta.status,
              resposta_tomticket: resultado,
              texto_tomticket: texto
            },
            500
          );
        }

        // --------------------------------------------------
        // NOTIFICAÇÃO GOOGLE CHAT
        // --------------------------------------------------

        const localConcluido = LOCAIS_QR[local_code] || local_code || "não informado";

        await notificarGoogleChat(
          env,
          "✅ Solicitação concluída.\n\n" +
          "Local: " + local_code + " — " + localConcluido +
          "\n\nRealizado por: " + nome
        );

        return respostaJSON({
          sucesso: true,
          mensagem: "Solicitação concluída e chamado finalizado no TomTicket.",
          ticket_id,
          nome,
          tomticket: resultado
        });
      } catch (error) {
        console.error("ERRO NA CONCLUSÃO:", error);
        return respostaJSON(
          {
            sucesso: false,
            etapa: "concluir",
            mensagem: "Erro interno ao processar a conclusão.",
            erro: error.message
          },
          500
        );
      }
    }

    // ====================================================
    // ROTA NÃO ENCONTRADA
    // ====================================================

    return respostaJSON({ sucesso: false, mensagem: "Rota não encontrada." }, 404);
  }
};
