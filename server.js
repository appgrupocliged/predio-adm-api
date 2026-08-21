const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOMTICKET_TOKEN = process.env.TOMTICKET_TOKEN;

app.get("/", (req, res) => {
    res.json({
        status: "online",
        mensagem: "API do sistema de solicitações funcionando"
    });
});

app.post("/solicitacao", async (req, res) => {
    try {
        const {
            department_id,
            category_id,
            subject,
            message,
            priority
        } = req.body;

        // Cliente fixo utilizado pela integração
        const customer_id = "appgrupocliged@gmail.com";
        const customer_id_type = "E";

        const dados = new URLSearchParams();

        dados.append("customer_id", customer_id);
        dados.append("customer_id_type", customer_id_type);
        dados.append("department_id", department_id);
        dados.append("category_id", category_id);
        dados.append("subject", subject);
        dados.append("message", message);
        dados.append("priority", priority || "2");

        const resposta = await axios.post(
            "https://api.tomticket.com/v2.0/ticket/new",
            dados.toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Bearer ${TOMTICKET_TOKEN}`
                }
            }
        );

        res.json({
            sucesso: true,
            tomticket: resposta.data
        });

    } catch (error) {
        console.error(
            "ERRO TOMTICKET STATUS:",
            error.response?.status
        );

        console.error(
            "ERRO TOMTICKET RESPOSTA:",
            JSON.stringify(error.response?.data, null, 2)
        );

        console.error(
            "ERRO TOMTICKET MENSAGEM:",
            error.message
        );

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar chamado no TomTicket",
            erro: error.response?.data || error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});
