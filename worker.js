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
// O código B.X é a identificação oficial do local.
//
// O nome usado no TomTicket é definido AQUI no Worker.
// Não depende do nome enviado pelo navegador.
//

const LOCAIS_QR = {

    "B.1": "DIRETORIA",

    "B.2": "CORREDOR AUTORIZAÇÃO",

    "B.3": "FINANCEIRO",

    "B.4": "RH",

    "B.5": "COMPRAS",

    "B.6": "ESTOQUE",

    "B.7": "ESTOQUE",

    "B.8": "CONTROLADORIA",

    "B.9": "COWORKING",

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
// RESPOSTA JSON
// ============================================================

function respostaJSON(dados, status = 200) {

    return new Response(
        JSON.stringify(dados),
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
                // RECEBE O JSON DO HTML
                // =================================================

                const body =
                    await request.json();


                const {

                    local_code,

                    category_id,

                    subject,

                    message,

                    priority

                } = body;


                // =================================================
                // VALIDAÇÃO DO CÓDIGO DO QR
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


                // =================================================
                // CONVERSÃO OFICIAL
                // =================================================
                //
                // O nome NÃO vem do navegador.
                //
                // Exemplo:
                //
                // B.19
                // ↓
                // QUALIDADE
                //
                // =================================================

                const local =
                    LOCAIS_QR[local_code];


                if (!local) {

                    return respostaJSON(
                        {
                            sucesso: false,

                            mensagem:
                                "Código de local inválido.",

                            codigo_recebido:
                                local_code
                        },
                        400
                    );

                }


                console.log(
                    "QR recebido:",
                    local_code
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
                // DADOS OBRIGATÓRIOS
                // =================================================

                if (
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
                // MENSAGEM
                // =================================================

                const mensagemFormatada =
                    String(message)
                        .replace(/\\n/g, "\n");


                // =================================================
                // ASSUNTO OFICIAL
                // =================================================
                //
                // O Worker também monta o assunto.
                //
                // Isso impede que o navegador mande:
                //
                // "Solicitação - HEAD"
                //
                // enquanto o QR é B.19.
                //
                // =================================================

                const assuntoOficial =
                    "Solicitação - " + local;


                // =================================================
                // MENSAGEM OFICIAL
                // =================================================
                //
                // O local oficial também é colocado no início
                // da mensagem.
                //
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
                // DADOS PARA O TOMTICKET
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
                // DEPARTAMENTO INFRAESTRUTURA
                // =================================================

                dados.append(
                    "department_id",
                    "2d507dafee35b29d9e5852d9b0c4ce2c"
                );


                // =================================================
                // CATEGORIA PRÉDIO ADM
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


                console.log(
                    "Enviando chamado para o TomTicket."
                );

                console.log(
                    "Código QR:",
                    local_code
                );

                console.log(
                    "Local oficial:",
                    local
                );

                console.log(
                    "Assunto:",
                    assuntoOficial
                );


                // =================================================
                // ENVIO PARA O TOMTICKET
                // =================================================

                const respostaTomTicket =
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
                // LÊ RESPOSTA
                // =================================================

                const textoResposta =
                    await respostaTomTicket.text();


                let dadosResposta;


                try {

                    dadosResposta =
                        JSON.parse(
                            textoResposta
                        );

                } catch {

                    dadosResposta = {

                        resposta:
                            textoResposta

                    };

                }


                console.log(
                    "Status TomTicket:",
                    respostaTomTicket.status
                );


                console.log(
                    "Resposta TomTicket:",
                    JSON.stringify(
                        dadosResposta,
                        null,
                        2
                    )
                );


                // =================================================
                // ERRO TOMTICKET
                // =================================================

                if (
                    !respostaTomTicket.ok
                ) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            mensagem:
                                "Erro ao criar chamado no TomTicket.",

                            local:
                                local,

                            codigo:
                                local_code,

                            erro:
                                dadosResposta

                        },
                        500
                    );

                }


                // =================================================
                // VERIFICA SUCESSO DO TOMTICKET
                // =================================================

                if (
                    dadosResposta &&
                    dadosResposta.success === false
                ) {

                    return respostaJSON(
                        {

                            sucesso: false,

                            mensagem:
                                "TomTicket não confirmou a criação do chamado.",

                            local:
                                local,

                            codigo:
                                local_code,

                            erro:
                                dadosResposta

                        },
                        500
                    );

                }


                // =================================================
                // SUCESSO
                // =================================================

                return respostaJSON({

                    sucesso: true,

                    local_code:
                        local_code,

                    local:
                        local,

                    subject:
                        assuntoOficial,

                    tomticket:
                        dadosResposta

                });

            }


            // =====================================================
            // ERRO GERAL
            // =====================================================

            catch (error) {

                console.error(
                    "ERRO NA API:",
                    error
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
