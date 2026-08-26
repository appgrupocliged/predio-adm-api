const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://appgrupocliged.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=UTF-8"
};

function respostaJSON(dados, status = 200) {
    return new Response(
        JSON.stringify(dados, null, 2),
        {
            status,
            headers: CORS_HEADERS
        }
    );
}

export default {
    async fetch(request, env) {

        // ==============================
        // CORS / PREFLIGHT
        // ==============================

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS
            });
        }

        const url = new URL(request.url);

        // ==============================
        // TESTE DA API
        // ==============================

        if (request.method === "GET" && url.pathname === "/") {
            return respostaJSON({
                status: "online",
                mensagem: "API do sistema de solicitações funcionando"
            });
        }

        // ==============================
        // CRIAÇÃO DO CHAMADO
        // ==============================

        if (
            request.method === "POST" &&
            url.pathname === "/solicitacao"
        ) {
            try {

                const body = await request.json();

                const {
                    department_id,
                    category_id,
                    subject,
                    message,
                    priority
                } = body;

                // ==============================
                // CLIENTE FIXO
                // ==============================

                const customer_id = "appgrupocliged@gmail.com";
                const customer_id_type = "E";

                // ==============================
                // VALIDAÇÃO
                // ==============================

                if (
                    !department_id ||
                    !category_id ||
                    !subject ||
                    !message
                ) {
                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem: "Dados obrigatórios não informados."
                        },
                        400
                    );
                }

                // ==============================
                // TOKEN
                // ==============================

                if (!env.TOMTICKET_TOKEN) {
                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem: "Token do TomTicket não configurado na API."
                        },
                        500
                    );
                }

                // ==============================
                // FORMATAÇÃO DA MENSAGEM
                // ==============================

                const mensagemFormatada =
                    String(message).replace(/\\n/g, "\n");

                // ==============================
                // DADOS PARA CRIAR CHAMADO
                // ==============================

                const dados = new URLSearchParams();

                dados.append("customer_id", customer_id);
                dados.append("customer_id_type", customer_id_type);
                dados.append("department_id", String(department_id));
                dados.append("category_id", String(category_id));
                dados.append("subject", String(subject));
                dados.append("message", mensagemFormatada);
                dados.append("priority", String(priority || "2"));

                // ==============================
                // 1. CRIAR CHAMADO
                // ==============================

                const respostaCriacao = await fetch(
                    "https://api.tomticket.com/v2.0/ticket/new",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded",
                            "Authorization":
                                `Bearer ${env.TOMTICKET_TOKEN}`
                        },
                        body: dados.toString()
                    }
                );

                const textoCriacao =
                    await respostaCriacao.text();

                let dadosCriacao;

                try {
                    dadosCriacao = JSON.parse(textoCriacao);
                } catch {
                    dadosCriacao = {
                        resposta: textoCriacao
                    };
                }

                // ==============================
                // VERIFICAÇÃO DA CRIAÇÃO
                // ==============================

                if (
                    !respostaCriacao.ok ||
                    dadosCriacao.error === true ||
                    dadosCriacao.success === false
                ) {
                    return respostaJSON(
                        {
                            sucesso: false,
                            etapa: "criacao",
                            mensagem:
                                "Erro ao criar chamado no TomTicket",
                            status_tomticket:
                                respostaCriacao.status,
                            resposta_tomticket:
                                dadosCriacao
                        },
                        500
                    );
                }

                // ==============================
                // PEGA O ID DO CHAMADO
                // ==============================

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
                            mensagem:
                                "Chamado criado, mas o TomTicket não retornou o ticket_id.",
                            tomticket:
                                dadosCriacao
                        },
                        500
                    );
                }

                // ==============================
                // 2. TRANSFERIR SEM ATENDENTE
                // ==============================

                const transferencia =
                    new URLSearchParams();

                transferencia.append(
                    "ticket_id",
                    String(ticket_id)
                );

                transferencia.append(
                    "department_id",
                    String(department_id)
                );

                // IMPORTANTE:
                // NÃO enviamos operator_id.
                //
                // A documentação do TomTicket informa que
                // operator_id é opcional no /ticket/transfer.
                // ==============================

                const respostaTransferencia =
                    await fetch(
                        "https://api.tomticket.com/v2.0/ticket/transfer",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`
                            },

                            body:
                                transferencia.toString()
                        }
                    );

                const textoTransferencia =
                    await respostaTransferencia.text();

                let dadosTransferencia;

                try {
                    dadosTransferencia =
                        JSON.parse(textoTransferencia);
                } catch {
                    dadosTransferencia = {
                        resposta:
                            textoTransferencia
                    };
                }

                // ==============================
                // RESPOSTA DE DIAGNÓSTICO
                // ==============================

                const transferenciaOK =
                    respostaTransferencia.ok &&
                    dadosTransferencia.error !== true &&
                    dadosTransferencia.success !== false;

                // ==============================
                // TRANSFERÊNCIA FALHOU
                // ==============================

                if (!transferenciaOK) {
                    return respostaJSON(
                        {
                            sucesso: false,

                            etapa: "transferencia",

                            mensagem:
                                "O chamado foi criado, mas a transferência para sem atendente falhou.",

                            chamado_criado: true,

                            ticket_id:
                                ticket_id,

                            criacao:
                                dadosCriacao,

                            transferencia: {
                                http_status:
                                    respostaTransferencia.status,

                                resposta:
                                    dadosTransferencia
                            }
                        },
                        500
                    );
                }

                // ==============================
                // SUCESSO
                // ==============================

                return respostaJSON({
                    sucesso: true,

                    mensagem:
                        "Chamado criado e transferência processada.",

                    ticket_id:
                        ticket_id,

                    criacao:
                        dadosCriacao,

                    transferencia: {
                        http_status:
                            respostaTransferencia.status,

                        resposta:
                            dadosTransferencia,

                        operator_id_enviado:
                            false
                    }
                });

            } catch (error) {

                console.error(
                    "ERRO NA API:",
                    error.message
                );

                return respostaJSON(
                    {
                        sucesso: false,

                        etapa: "worker",

                        mensagem:
                            "Erro interno ao processar a solicitação.",

                        erro:
                            error.message
                    },
                    500
                );
            }
        }

        // ==============================
        // ROTA NÃO ENCONTRADA
        // ==============================

        return respostaJSON(
            {
                sucesso: false,
                mensagem: "Rota não encontrada."
            },
            404
        );
    }
};
