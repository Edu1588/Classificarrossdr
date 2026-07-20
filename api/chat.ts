import { GoogleGenAI, Type, Schema } from "@google/genai";
import Groq from "groq-sdk";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Pelo menos uma API KEY (GROQ_API_KEY ou GEMINI_API_KEY) é necessária" });
  }

  try {
    const { message, conversationHistory, currentState } = req.body;
    
    const systemPrompt = `Você é um assistente de vendas de carros atencioso e humano de uma concessionária chamada "Classificarros".
Seu objetivo é ser o cérebro das respostas do chat, avaliando a mensagem do usuário e retornando a próxima ação em formato JSON.

REGRAS:
1. Filtre ofensas: Se o usuário disser algo ofensivo, palavrões ou desrespeitoso, retorne a flag isOffensive: true e uma resposta educada pedindo respeito, sem avançar o fluxo. Atenção: Mensagens sem sentido (ex: "ghghgh", "asdasd") NÃO são ofensas. Se não entender, não marque como ofensivo, apenas peça para o usuário esclarecer.
2. Seja humano, empático e amigável.
3. Baseado no estado atual e na resposta do usuário, você deve determinar qual é o próximo passo, se há algum dado a ser extraído (dataKey e dataValue) e qual a pontuação (scoreIncrement) para o CRM.
4. Informações da loja: A Classificarros fica localizada na Rua Carolina Florence, 410 - Guanabara - Campinas/SP. O WhatsApp para contato direto é (19) 9 9122-9804. Forneça estas informações se o usuário perguntar.

ESTADO ATUAL (currentState): ${currentState}

Siga ESTRITAMENTE a lógica de estados abaixo. Baseado no ESTADO ATUAL, você deve executar a Ação correspondente:
- Se ESTADO ATUAL = "START": O usuário informou o nome. Ação: Chame o usuário pelo nome (sem dizer que o nome está "correto") e solicite o número de WhatsApp dizendo ESTRITAMENTE que é para prosseguirmos com o atendimento. É PROIBIDO usar palavras como "contatar", "entrar em contato", "manter informado" ou "te avisar". Apenas peça o WhatsApp para prosseguir e não ofereça ajuda ainda. (nextStep: "GET_WHATSAPP", dataKey: "name", dataValue: <nome extraido>)
- Se ESTADO ATUAL = "GET_WHATSAPP": O usuário informou o WhatsApp. Ação: Agradeça e pergunte como ele quer ser ajudado (Comprar/Trocar, Vender, Simular Financiamento ou Outros). (nextStep: "HELP", dataKey: "whatsapp", dataValue: <whatsapp extraido>)
- Se ESTADO ATUAL = "HELP": O usuário escolheu o que deseja. Ação:
  - Se quer comprar/trocar -> direcione para COMPRAR_1 (nextStep: "COMPRAR_1", dataKey: "intent", dataValue: "Comprar/Trocar", scoreIncrement: 5). Pergunta se já viu no site, quer por preço ou tá indeciso.
  - Se quer vender -> direcione para VENDER_1 (nextStep: "VENDER_1", dataKey: "intent", dataValue: "Vender", scoreIncrement: 5). Pede marca/modelo.
  - Se quer simular -> direcione para SIMULAR_ENTRADA (nextStep: "SIMULAR_ENTRADA", dataKey: "intent", dataValue: "Financiamento", scoreIncrement: 5). Pede o valor da entrada.
  - Se outros -> direcione para OUTRAS_ASSUNTO (nextStep: "OUTRAS_ASSUNTO", dataKey: "intent", dataValue: "Outros").

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

Sempre retorne APENAS um JSON válido com a seguinte estrutura:
{
  "isOffensive": boolean,
  "botText": "Sua resposta humanizada e contextualizada (Faça perguntas abertas, NUNCA dê opções fechadas em formato de lista)",
  "nextStep": "NOME_DO_PROXIMO_ESTADO",
  "dataKey": "chave do dado extraido, null se não houver",
  "dataValue": "valor do dado extraido, null se não houver",
  "scoreIncrement": numero (0 se não houver incremento)
}`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        isOffensive: {
          type: Type.BOOLEAN,
        },
        botText: {
          type: Type.STRING,
          description: "Sua resposta humanizada e contextualizada (Faça perguntas abertas, NUNCA dê opções fechadas em formato de lista)"
        },
        nextStep: {
          type: Type.STRING,
          description: "NOME_DO_PROXIMO_ESTADO"
        },
        dataKey: {
          type: Type.STRING,
          description: "chave do dado extraido, null se não houver",
          nullable: true
        },
        dataValue: {
          type: Type.STRING,
          description: "valor do dado extraido, null se não houver",
          nullable: true
        },
        scoreIncrement: {
          type: Type.INTEGER,
          description: "numero (0 se não houver incremento)"
        }
      },
      required: ["isOffensive", "botText", "nextStep", "scoreIncrement"]
    };

    let result;

    try {
      if (!groq) throw new Error("Groq API não configurada");
      
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.map((msg: any) => ({
            role: msg.sender === 'bot' ? 'assistant' : 'user',
            content: msg.text
          })),
          { role: "user", content: message }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content || "{}";
      result = JSON.parse(content);
    } catch (groqError: any) {
      console.warn("Groq falhou (provavelmente rate limit). Alternando para Gemini como fallback.", groqError.message);
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GROQ falhou e GEMINI_API_KEY não configurada para fallback.");
      }

      const historyMessages = conversationHistory.map((msg: any) => ({
        role: msg.sender === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
  
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...historyMessages,
          { role: 'user', parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });
  
      const content = response.text || "{}";
      result = JSON.parse(content);
    }
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
