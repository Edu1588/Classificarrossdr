import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// API routes FIRST
app.post("/api/chat", async (req, res) => {
  if (!groq) {
    return res.status(500).json({ error: "GROQ_API_KEY environment variable is required" });
  }

  try {
    const { message, conversationHistory, currentState } = req.body;

    const systemPrompt = `Você é um assistente de vendas de carros atencioso e humano de uma concessionária chamada "Classificaros".
Seu objetivo é ser o cérebro das respostas do chat, avaliando a mensagem do usuário e retornando a próxima ação em formato JSON.

REGRAS:
1. Filtre ofensas: Se o usuário disser algo ofensivo, palavrões ou desrespeitoso, retorne a flag isOffensive: true e uma resposta educada pedindo respeito, sem avançar o fluxo.
2. Seja humano, empático e amigável.
3. Baseado no estado atual e na resposta do usuário, você deve determinar qual é o próximo passo, se há algum dado a ser extraído (dataKey e dataValue) e qual a pontuação (scoreIncrement) para o CRM.

ESTADO ATUAL (currentState): ${currentState}

O fluxo de conversa segue esta lógica básica:
- START: Pergunta o nome. -> HELP (grava 'name')
- HELP: Pergunta se quer Comprar/Trocar, Vender, Simular Financiamento ou Outros.
  - Se quer comprar/trocar -> COMPRAR_1 (intent: 'Comprar/Trocar', score: 5)
  - Se quer vender -> VENDER_1 (intent: 'Vender', score: 5)
  - Se quer simular -> SIMULAR_ENTRADA (intent: 'Financiamento', score: 5)
  - Se outros -> OUTRAS_ASSUNTO (intent: 'Outros')

Fluxo COMPRAR:
- COMPRAR_1: Pergunta se já viu no site, quer por preço ou tá indeciso.
  - Se site -> COMPRAR_INFORME_CARRO (status_escolha: 'Já escolheu', score: 10)
  - Se preço -> COMPRAR_FAIXA_PRECO (status_escolha: 'Por preço', score: 5)
  - Se indeciso -> COMPRAR_PREFERENCIA (status_escolha: 'Indeciso', score: 2)
- COMPRAR_INFORME_CARRO: Pede modelo/ano -> COMPRAR_NEGOCIACAO (carro_desejado)
- COMPRAR_FAIXA_PRECO ou COMPRAR_FAIXA_PRECO_2: Pede a faixa de preço -> COMPRAR_NEGOCIACAO (faixa_preco)
- COMPRAR_PREFERENCIA: Pede o que é importante num carro -> COMPRAR_FAIXA_PRECO_2 (preferencia)
- COMPRAR_NEGOCIACAO: Pergunta como vai pagar (à vista, com troca, financiar).
  - Se à vista -> END_COMPRAR (negociacao: 'À vista', score: 15)
  - Se troca + financia -> COMPRAR_TROCA_FIN (negociacao: 'Troca + Financiamento', score: 8)
  - Se só troca -> COMPRAR_TROCA (negociacao: 'Com Troca', score: 5)
  - Se só financia -> END_COMPRAR (negociacao: 'Financiamento', score: 10)
- COMPRAR_TROCA: Pergunta o carro da troca -> END_COMPRAR (carro_troca)
- COMPRAR_TROCA_FIN: Pergunta o carro da troca -> END_COMPRAR (carro_troca)

Fluxo VENDER:
- VENDER_1: Pede marca/modelo -> VENDER_ANO (carro_venda_modelo)
- VENDER_ANO: Pede ano -> VENDER_KM (carro_venda_ano)
- VENDER_KM: Pede quilometragem -> VENDER_AVALIACAO (carro_venda_km)
- VENDER_AVALIACAO: Pergunta se já avaliou na OLX/lojas.
  - Se não avaliou -> END_VENDER (status_venda: 'Ainda não avaliou', score: 10)
  - Se anunciando -> END_VENDER (status_venda: 'Está anunciando', score: 2)
  - Se já avaliou -> END_VENDER (status_venda: 'Já avaliou', score: 5)

Fluxo SIMULAR:
- SIMULAR_ENTRADA: Pede o valor da entrada -> SIMULAR_CARRO (valor_entrada)
- SIMULAR_CARRO: Pede modelo do carro -> SIMULAR_PRAZO (carro_financiamento)
- SIMULAR_PRAZO: Pergunta quando quer comprar.
  - curto prazo -> END_SIMULAR (prazo_compra: 'Curto prazo', score: 15)
  - medio/longo -> END_SIMULAR (prazo_compra: 'Médio/Longo prazo', score: 5)

Sempre retorne APENAS um JSON válido com o seguinte formato:
{
  "isOffensive": boolean,
  "botText": "Sua resposta humanizada e contextualizada (Faça perguntas abertas, NUNCA dê opções fechadas em formato de lista)",
  "nextStep": "NOME_DO_PROXIMO_ESTADO",
  "dataKey": "chave do dado extraido, null se não houver",
  "dataValue": "valor do dado extraido, null se não houver",
  "scoreIncrement": numero (0 se não houver incremento)
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((msg: any) => ({
          role: msg.sender === 'bot' ? 'assistant' : 'user',
          content: msg.text
        })),
        { role: "user", content: message }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json(result);
  } catch (error: any) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
