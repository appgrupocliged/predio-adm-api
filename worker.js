const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://appgrupocliged.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=UTF-8"
};

function respostaJSON(dados, status = 200) {
    return new Response(
        JSON.stringify(dados),
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

                // ==============================
                // LÊ O JSON DO SITE
                // ==============================

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

                const customer_id =
                    "appgrupocliged@gmail.com";

                const customer_id_type = "E";

                // ==============================
                // VERIFICAÇÃO DOS DADOS
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
                            mensagem:
                                "Dados obrigatórios não informados."
                        },
                        400
                    );
                }

                // ==============================
                // VERIFICAÇÃO DO TOKEN
                // ==============================

                if (!env.TOMTICKET_TOKEN) {

                    console.error(
                        "TOMTICKET_TOKEN não configurado."
                    );

                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem:
                                "Token do TomTicket não configurado na API."
                        },
                        500
                    );
                }

                // ==============================
                // FORMATAÇÃO DA MENSAGEM
                // ==============================

                const mensagemFormatada =
                    String(message)
                        .replace(/\\n/g, "\n");

                // ==============================
                // DADOS DO NOVO CHAMADO
                // ==============================

                const dados = new URLSearchParams();

                dados.append(
                    "customer_id",
                    customer_id
                );

                dados.append(
                    "customer_id_type",
                    customer_id_type
                );

                dados.append(
                    "department_id",
                    String(department_id)
                );

                dados.append(
                    "category_id",
                    String(category_id)
                );

                dados.append(
                    "subject",
                    String(subject)
                );

                dados.append(
                    "message",
                    mensagemFormatada
                );

                dados.append(
                    "priority",
                    String(priority || "2")
                );

                console.log(
                    "Criando chamado no TomTicket..."
                );

                // ==============================
                // 1. CRIA O CHAMADO
                // ==============================

                const respostaCriacao =
                    await fetch(
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
                    dadosCriacao =
                        JSON.parse(textoCriacao);
                } catch {
                    dadosCriacao = {
                        resposta: textoCriacao
                    };
                }

                console.log(
                    "Status criação:",
                    respostaCriacao.status
                );

                console.log(
                    "Resposta criação:",
                    JSON.stringify(
                        dadosCriacao,
                        null,
                        2
                    )
                );

                // ==============================
                // ERRO AO CRIAR CHAMADO
                // ==============================

                if (
                    !respostaCriacao.ok ||
                    dadosCriacao.error === true ||
                    dadosCriacao.success === false
                ) {
                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem:
                                "Erro ao criar chamado no TomTicket",
                            erro: dadosCriacao
                        },
                        500
                    );
                }

                // ==============================
                // O TOMTICKET RETORNA O TICKET_ID
                // ==============================

                const ticket_id =
                    dadosCriacao.ticket_id ||
                    dadosCriacao.id ||
                    dadosCriacao.data?.ticket_id ||
                    dadosCriacao.data?.id;

                // ==============================
                // SEGURANÇA
                // ==============================

                if (!ticket_id) {

                    console.error(
                        "Chamado criado, mas o TomTicket não retornou ticket_id."
                    );

                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem:
                                "Chamado criado no TomTicket, mas não foi possível obter o ID para finalizar a configuração.",
                            tomticket: dadosCriacao
                        },
                        500
                    );
                }

                console.log(
                    "Chamado criado:",
                    ticket_id
                );

                // ==================================================
                // 2. TRANSFERE PARA O DEPARTAMENTO SEM ATENDENTE
                // ==================================================
                //
                // IMPORTANTE:
                // Não enviamos operator_id.
                //
                // A intenção é deixar o chamado em "Sem Atendente".
                //
                // ==================================================

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

                console.log(
                    "Transferindo chamado para o departamento sem atendente..."
                );

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
                        resposta: textoTransferencia
                    };
                }

                console.log(
                    "Status transferência:",
                    respostaTransferencia.status
                );

                console.log(
                    "Resposta transferência:",
                    JSON.stringify(
                        dadosTransferencia,
                        null,
                        2
                    )
                );

                // ==================================================
                // SE A TRANSFERÊNCIA FALHAR
                // ==================================================
                //
                // Não existe rollback de exclusão aqui.
                // O chamado já foi criado.
                //
                // Então informamos exatamente o que aconteceu.
                //
                // ==================================================

                if (
                    !respostaTransferencia.ok ||
                    dadosTransferencia.error === true ||
                    dadosTransferencia.success === false
                ) {

                    console.error(
                        "TRANSFERÊNCIA FALHOU."
                    );

                    return respostaJSON(
                        {
                            sucesso: false,

                            mensagem:
                                "O chamado foi criado no TomTicket, mas não foi possível deixá-lo sem atendente.",

                            ticket_id: ticket_id,

                            chamado_criado: true,

                            erro_transferencia:
                                dadosTransferencia,

                            tomticket:
                                dadosCriacao
                        },
                        500
                    );
                }

                // ==============================
                // SUCESSO FINAL
                // ==============================

                console.log(
                    "Chamado criado e deixado sem atendente:",
                    ticket_id
                );

                return respostaJSON({
                    sucesso: true,

                    mensagem:
                        "Chamado criado com sucesso e deixado sem atendente.",

                    ticket_id: ticket_id,

                    tomticket:
                        dadosCriacao,

                    transferencia:
                        dadosTransferencia
                });

            } catch (error) {

                console.error(
                    "ERRO NA API:",
                    error.message
                );

                return respostaJSON(
                    {
                        sucesso: false,

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
