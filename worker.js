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

    "B.01": "B.01 - DIRETORIA",

    "B.02": "B.02 - CORREDOR AUTORIZAÇÃO",

    "B.03": "B.03 - FINANCEIRO",

    "B.04": "B.04 - RH",

    "B.05": "B.05 - COMPRAS",

    "B.06": "B.06 - ESTOQUE",

    "B.07": "B.07 - ESTOQUE",

    "B.08": "B.08 - CONTROLADORIA",

    "B.09": "B.09 - COWORKING",

    "B.10": "B.10 - CORREDOR REUNIÃO",

    "B.11": "B.11 - D.P",

    "B.12": "B.12 - CORREDOR CALL CENTER",

    "B.13": "B.13 - COMFORT ADM",

    "B.14": "B.14 - T.I",

    "B.15": "B.15 - CTA ADM",

    "B.16": "B.16 - MARKETING / INFRAESTRUTURA",

    "B.17": "B.17 - FATURAMENTO",

    "B.18": "B.18 - AUDITORIA",

    "B.19": "B.19 - QUALIDADE"

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


        const url =
            new URL(request.url);


        // ====================================================
        // TESTE DA API
        // ====================================================

        if (
            request.method === "GET" &&
            url.pathname === "/"
        ) {

            return respostaJSON({

                status:
                    "online",

                mensagem:
                    "API do sistema de solicitações funcionando",

                locais_qr:
                    Object.keys(
                        LOCAIS_QR
                    ).length

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
                // RECEBE JSON
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
                // VALIDA QR
                // =================================================

                if (!local_code) {

                    return respostaJSON(
                        {

                            sucesso:
                                false,

                            mensagem:
                                "Código do local não informado."

                        },
                        400
                    );

                }


                const codigoQR =
                    String(
                        local_code
                    )
                    .trim()
                    .toUpperCase();


                const local =
                    LOCAIS_QR[
                        codigoQR
                    ];


                if (!local) {

                    return respostaJSON(
                        {

                            sucesso:
                                false,

                            mensagem:
                                "Código de local inválido.",

                            codigo_recebido:
                                codigoQR

                        },
                        400
                    );

                }


                // =================================================
                // LOG
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
                // VALIDA DADOS
                // =================================================

                if (
                    !department_id ||
                    !category_id ||
                    !subject ||
                    !message
                ) {

                    return respostaJSON(
                        {

                            sucesso:
                                false,

                            mensagem:
                                "Dados obrigatórios não informados.",

                            diagnostico: {

                                local_code:
                                    codigoQR,

                                local:
                                    local,

                                department_id_recebido:
                                    !!department_id,

                                category_id_recebido:
                                    !!category_id,

                                subject_recebido:
                                    !!subject,

                                message_recebido:
                                    !!message

                            }

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

                            sucesso:
                                false,

                            mensagem:
                                "Token do TomTicket não configurado na API."

                        },
                        500
                    );

                }


                // =================================================
                // MENSAGEM
                // =================================================

                const mensagemFormatada =
                    String(
                        message
                    )
                    .replace(
                        /\\n/g,
                        "\n"
                    );


                // =================================================
                // ASSUNTO OFICIAL
                // =================================================

                const assuntoOficial =
                    "Solicitação - " +
                    local;


                // =================================================
                // MENSAGEM OFICIAL
                // =================================================

                const mensagemOficial =
                    "Local: " +
                    local +
                    "\n\n" +
                    mensagemFormatada
                        .replace(
                            /^Local:.*\n*/i,
                            ""
                        );


                // =================================================
                // DADOS TOMTICKET
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


                dados.append(
                    "department_id",
                    String(
                        department_id
                    )
                );


                dados.append(
                    "category_id",
                    String(
                        category_id
                    )
                );


                dados.append(
                    "subject",
                    assuntoOficial
                );


                dados.append(
                    "message",
                    mensagemOficial
                );


                dados.append(
                    "priority",
                    String(
                        priority || "2"
                    )
                );


                console.log(
                    "Enviando chamado para o TomTicket."
                );

                console.log(
                    "Código QR:",
                    codigoQR
                );

                console.log(
                    "Local oficial:",
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


                // =================================================
                // 1. CRIAR CHAMADO
                // =================================================

                const respostaCriacao =
                    await fetch(
                        "https://api.tomticket.com/v2.0/ticket/new",
                        {

                            method:
                                "POST",

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


                const textoCriacao =
                    await respostaCriacao.text();


                let dadosCriacao;


                try {

                    dadosCriacao =
                        JSON.parse(
                            textoCriacao
                        );

                }
                catch {

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
                // VERIFICAÇÃO
                // =================================================

                if (
                    !respostaCriacao.ok ||
                    dadosCriacao.error === true ||
                    dadosCriacao.success === false
                ) {

                    return respostaJSON(
                        {

                            sucesso:
                                false,

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
                // PEGA ID
                // =================================================

                const ticket_id =
                    dadosCriacao.ticket_id ||
                    dadosCriacao.id ||
                    dadosCriacao.data?.ticket_id ||
                    dadosCriacao.data?.id;


                if (!ticket_id) {

                    return respostaJSON(
                        {

                            sucesso:
                                false,

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


                // =================================================
                // 2. TRANSFERIR PARA DEPARTAMENTO
                //    SEM ATENDENTE
                // =================================================

                const transferencia =
                    new URLSearchParams();


                transferencia.append(
                    "ticket_id",
                    String(
                        ticket_id
                    )
                );


                transferencia.append(
                    "department_id",
                    String(
                        department_id
                    )
                );


                // IMPORTANTE:
                // NÃO enviamos operator_id.


                const respostaTransferencia =
                    await fetch(
                        "https://api.tomticket.com/v2.0/ticket/transfer",
                        {

                            method:
                                "POST",

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
                        JSON.parse(
                            textoTransferencia
                        );

                }
                catch {

                    dadosTransferencia = {

                        resposta:
                            textoTransferencia

                    };

                }


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

                            sucesso:
                                false,

                            etapa:
                                "transferencia",

                            mensagem:
                                "O chamado foi criado, mas a transferência para o departamento falhou.",

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

                        sucesso:
                            false,

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

                sucesso:
                    false,

                mensagem:
                    "Rota não encontrada."

            },
            404
        );

    }

};
