const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://appgrupocliged.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=UTF-8"
};


// ============================================================
// MAPA OFICIAL DOS QR CODES
// ============================================================
//
// O código B.X identifica o local.
//
// O nome oficial do local é definido aqui no Worker.
//
// ============================================================

const LOCAIS_QR = {

    "B.1": "DIRETORIA",

    "B.2": "AUTORIZAÇÃO",

    "B.3": "FINANCEIRO",

    "B.4": "RH",

    "B.5": "COMPRAS",

    "B.6": "ESTOQUE",

    "B.7": "ESTOQUE",

    "B.8": "CONTROLADORIA",

    "B.9": "COWORKING",

    "B.10": "GERÊNCIA",

    "B.11": "D.P",

    "B.12": "CALL CENTER",

    "B.13": "COMFORT",

    "B.14": "T.I",

    "B.15": "CTA",

    "B.16": "MARKETING",

    "B.17": "FATURAMENTO",

    "B.18": "AUDITORIA",

    "B.19": "QUALIDADE"

};


// ============================================================
// RESPOSTA JSON
// ============================================================

function respostaJSON(dados, status = 200) {

    return new Response(
        JSON.stringify(dados, null, 2),
        {
            status,
            headers: CORS_HEADERS
        }
    );

}


// ============================================================
// WORKER
// ============================================================

export default {

    async fetch(request, env) {

        // ====================================================
        // CORS / PREFLIGHT
        // ====================================================

        if (request.method === "OPTIONS") {

            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS
            });

        }


        const url = new URL(request.url);


        // ====================================================
        // TESTE DA API
        // ====================================================

        if (
            request.method === "GET" &&
            url.pathname === "/"
        ) {

            return respostaJSON({

                status: "online",

                mensagem:
                    "API do sistema de solicitações funcionando",

                locais_qr:
                    Object.keys(LOCAIS_QR).length

            });

        }


        // ====================================================
        // CRIAÇÃO DO CHAMADO
        // ====================================================

        if (
            request.method === "POST" &&
            url.pathname === "/solicitacao"
        ) {

            try {

                // =================================================
                // RECEBE JSON DO HTML
                // =================================================

                const body =
                    await request.json();


                const {

                    local_code,

                    department_id,

                    category_id,

                    subject,

                    message,

                    priority

                } = body;


                // =================================================
                // VALIDAÇÃO DO QR CODE
                // =================================================
                //
                // O HTML deve enviar:
                //
                // local_code: "B.17"
                //
                // O Worker converte:
                //
                // B.17 → FATURAMENTO
                //
                // =================================================

                if (!local_code) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            mensagem:
                                "Código do local não informado."

                        },
                        400
                    );

                }


                const codigoQR =
                    String(local_code)
                        .trim()
                        .toUpperCase();


                const local =
                    LOCAIS_QR[codigoQR];


                if (!local) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            mensagem:
                                "Código de local inválido.",

                            codigo_recebido:
                                codigoQR

                        },
                        400
                    );

                }


                // =================================================
                // LOG DO QR
                // =================================================

                console.log(
                    "QR recebido:",
                    codigoQR
                );


                console.log(
                    "Local identificado:",
                    local
                );


                // =================================================
                // CLIENTE FIXO
                // =================================================

                const customer_id =
                    "appgrupocliged@gmail.com";


                const customer_id_type =
                    "E";


                // =================================================
                // VALIDAÇÃO DOS DADOS OBRIGATÓRIOS
                // =================================================

                if (
                    !department_id ||
                    !category_id ||
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


                // =================================================
                // TOKEN
                // =================================================

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


                // =================================================
                // FORMATAÇÃO DA MENSAGEM
                // =================================================

                const mensagemFormatada =
                    String(message)
                        .replace(/\\n/g, "\n");


                // =================================================
                // ASSUNTO OFICIAL
                // =================================================
                //
                // O assunto passa a ser definido pelo QR.
                //
                // B.17 → Solicitação - FATURAMENTO
                //
                // B.19 → Solicitação - QUALIDADE
                //
                // =================================================

                const assuntoOficial =
                    "Solicitação - " + local;


                // =================================================
                // MENSAGEM OFICIAL
                // =================================================
                //
                // O Worker garante que o local correto apareça
                // na mensagem.
                //
                // =================================================

                const mensagemSemLocal =
                    mensagemFormatada
                        .replace(
                            /^Local:.*\n*/i,
                            ""
                        );


                const mensagemOficial =
                    "Local: " +
                    local +
                    "\n\n" +
                    mensagemSemLocal;


                // =================================================
                // DADOS PARA CRIAR CHAMADO
                // =================================================

                const dados =
                    new URLSearchParams();


                dados.append(
                    "customer_id",
                    customer_id
                );


                dados.append(
                    "customer_id_type",
                    customer_id_type
                );


                // =================================================
                // DEPARTAMENTO
                // =================================================
                //
                // MANTIDO EXATAMENTE COMO NO WORKER ANTIGO.
                //
                // =================================================

                dados.append(
                    "department_id",
                    String(department_id)
                );


                // =================================================
                // CATEGORIA
                // =================================================

                dados.append(
                    "category_id",
                    String(category_id)
                );


                // =================================================
                // ASSUNTO
                // =================================================

                dados.append(
                    "subject",
                    assuntoOficial
                );


                // =================================================
                // MENSAGEM
                // =================================================

                dados.append(
                    "message",
                    mensagemOficial
                );


                // =================================================
                // PRIORIDADE
                // =================================================

                dados.append(
                    "priority",
                    String(priority || "2")
                );


                // =================================================
                // LOG
                // =================================================

                console.log(
                    "======================================"
                );

                console.log(
                    "CRIANDO CHAMADO"
                );

                console.log(
                    "Código QR:",
                    codigoQR
                );

                console.log(
                    "Local:",
                    local
                );

                console.log(
                    "Departamento:",
                    department_id
                );

                console.log(
                    "Categoria:",
                    category_id
                );

                console.log(
                    "Assunto:",
                    assuntoOficial
                );

                console.log(
                    "======================================"
                );


                // =================================================
                // 1. CRIAR CHAMADO
                // =================================================

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

                            body:
                                dados.toString()

                        }
                    );


                // =================================================
                // LÊ RESPOSTA DA CRIAÇÃO
                // =================================================

                const textoCriacao =
                    await respostaCriacao.text();


                let dadosCriacao;


                try {

                    dadosCriacao =
                        JSON.parse(
                            textoCriacao
                        );

                } catch {

                    dadosCriacao = {

                        resposta:
                            textoCriacao

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


                // =================================================
                // VERIFICAÇÃO DA CRIAÇÃO
                // =================================================

                if (
                    !respostaCriacao.ok ||
                    dadosCriacao.error === true ||
                    dadosCriacao.success === false
                ) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            etapa:
                                "criacao",

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


                // =================================================
                // PEGA ID DO CHAMADO
                // =================================================

                const ticket_id =
                    dadosCriacao.ticket_id ||
                    dadosCriacao.id ||
                    dadosCriacao.data?.ticket_id ||
                    dadosCriacao.data?.id;


                if (!ticket_id) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            etapa:
                                "criacao",

                            mensagem:
                                "Chamado criado, mas o TomTicket não retornou o ticket_id.",

                            tomticket:
                                dadosCriacao

                        },
                        500
                    );

                }


                console.log(
                    "Ticket criado:",
                    ticket_id
                );


                // =================================================
                // 2. TRANSFERIR PARA O DEPARTAMENTO
                // =================================================
                //
                // IMPORTANTE:
                //
                // NÃO enviamos operator_id.
                //
                // Isso preserva o comportamento anterior:
                //
                // Departamento recebe o chamado
                // sem atendente definido manualmente.
                //
                // =================================================

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


                // =================================================
                // ENVIA TRANSFERÊNCIA
                // =================================================

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


                // =================================================
                // LÊ RESPOSTA DA TRANSFERÊNCIA
                // =================================================

                const textoTransferencia =
                    await respostaTransferencia.text();


                let dadosTransferencia;


                try {

                    dadosTransferencia =
                        JSON.parse(
                            textoTransferencia
                        );

                } catch {

                    dadosTransferencia = {

                        resposta:
                            textoTransferencia

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


                // =================================================
                // VERIFICA TRANSFERÊNCIA
                // =================================================

                const transferenciaOK =
                    respostaTransferencia.ok &&
                    dadosTransferencia.error !== true &&
                    dadosTransferencia.success !== false;


                // =================================================
                // TRANSFERÊNCIA FALHOU
                // =================================================

                if (!transferenciaOK) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            etapa:
                                "transferencia",

                            mensagem:
                                "O chamado foi criado, mas a transferência para sem atendente falhou.",

                            chamado_criado:
                                true,

                            ticket_id:
                                ticket_id,

                            local_code:
                                codigoQR,

                            local:
                                local,

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


                // =================================================
                // SUCESSO
                // =================================================

                return respostaJSON({

                    sucesso:
                        true,

                    mensagem:
                        "Chamado criado e transferência processada.",

                    ticket_id:
                        ticket_id,

                    local_code:
                        codigoQR,

                    local:
                        local,

                    subject:
                        assuntoOficial,

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

            }


            // =====================================================
            // ERRO GERAL
            // =====================================================

            catch (error) {

                console.error(
                    "ERRO NA API:",
                    error.message
                );


                return respostaJSON(
                    {

                        sucesso: false,

                        etapa:
                            "worker",

                        mensagem:
                            "Erro interno ao processar a solicitação.",

                        erro:
                            error.message

                    },
                    500
                );

            }

        }


        // ========================================================
        // ROTA NÃO ENCONTRADA
        // ========================================================

        return respostaJSON(
            {

                sucesso: false,

                mensagem:
                    "Rota não encontrada."

            },
            404
        );

    }

};
