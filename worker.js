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
                const body = await request.json();

                const {
                    department_id,
                    category_id,
                    subject,
                    message,
                    priority
                } = body;

                // Cliente fixo utilizado pela integração
                const customer_id = "appgrupocliged@gmail.com";
                const customer_id_type = "E";

                // Verificação básica dos dados
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

                // Verifica se o token foi configurado no Cloudflare
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

                const mensagemFormatada = String(message)
                    .replace(/\\n/g, "\n");

                // ==============================
                // DADOS PARA O TOMTICKET
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
                    "Enviando solicitação para o TomTicket."
                );

                // ==============================
                // ENVIO PARA O TOMTICKET
                // ==============================

                const respostaTomTicket = await fetch(
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

                const textoResposta =
                    await respostaTomTicket.text();

                let dadosResposta;

                try {
                    dadosResposta =
                        JSON.parse(textoResposta);
                } catch {
                    dadosResposta = {
                        resposta: textoResposta
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

                // ==============================
                // ERRO DO TOMTICKET
                // ==============================

                if (!respostaTomTicket.ok) {
                    return respostaJSON(
                        {
                            sucesso: false,
                            mensagem:
                                "Erro ao criar chamado no TomTicket",
                            erro: dadosResposta
                        },
                        500
                    );
                }

                // ==============================
                // SUCESSO
                // ==============================

                return respostaJSON({
                    sucesso: true,
                    tomticket: dadosResposta
                });
            }

            // ==============================
            // ERRO GERAL
            // ==============================

            catch (error) {
                console.error(
                    "ERRO NA API:",
                    error.message
                );

                return respostaJSON(
                    {
                        sucesso: false,
                        mensagem:
                            "Erro interno ao processar a solicitação.",
                        erro: error.message
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
