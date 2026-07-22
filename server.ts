import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Inventory Cache
let cachedVehicles: any[] = [];
let lastFetchTime = 0;

async function getVehicles() {
  if (Date.now() - lastFetchTime > 1000 * 60 * 60) { // 1 hour cache
    try {
      const res = await fetch("https://classificarros.com.br/vehicles.json");
      cachedVehicles = await res.json();
      lastFetchTime = Date.now();
    } catch (e) {
      console.error("Erro ao buscar veículos", e);
    }
  }
  return cachedVehicles;
}

// API routes FIRST
app.post("/api/chat", async (req, res) => {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Pelo menos uma API KEY (GROQ_API_KEY ou GEMINI_API_KEY) é necessária" });
  }

  try {
    const { message, conversationHistory, currentState, knownLeads } = req.body;
    
    let inventoryContext = "";
    
    let knownLeadsContext = "";
    if (knownLeads && knownLeads.length > 0 && currentState !== 'START') {
        const validLeads = knownLeads.filter((l: any) => l.whatsapp);
        if (validLeads.length > 0) {
            knownLeadsContext = `\n\n[INFORMAÇÃO DE SISTEMA: CLIENTES RECORRENTES]
A identificação de um cliente recorrente DEVE ser baseada EXCLUSIVAMENTE se o número de WhatsApp informado na mensagem do usuário existe na lista abaixo.
NUNCA faça essa verificação ou dê as boas-vindas baseado apenas no nome do usuário (nomes podem ser repetidos e você ainda não tem o telefone dele).
Se o usuário informar um número de WhatsApp que já existe na lista abaixo, você DEVE dar as boas-vindas dizendo "Bem-vindo de volta, [Nome do Cliente cadastrado]!" e perguntar qual das seguintes opções ele deseja seguir, apresentando-as textualmente de forma natural para guiar o usuário: Comprar/Trocar um veículo, Vender seu veículo, Simular Financiamento ou Outros assuntos.
Leads já cadastrados:
${validLeads.map((l: any) => `- Nome: ${l.name}, WhatsApp: ${l.whatsapp}`).join('\n')}
`;
        }
    }
    
    // Inject inventory context when the user is trying to find a car
    if (['HELP', 'COMPRAR_INFORME_CARRO', 'COMPRAR_FAIXA_PRECO', 'COMPRAR_PREFERENCIA', 'COMPRAR_FAIXA_PRECO_2', 'COMPRAR_NEGOCIACAO', 'COMPRAR_1'].includes(currentState)) {
       const vehicles = await getVehicles();
       
       // Extrair marcas e modelos únicos do estoque para validação inteligente
       const allBrands = Array.from(new Set(vehicles.map((v: any) => v.brand.toLowerCase())));
       const allModels = Array.from(new Set(vehicles.map((v: any) => v.model.toLowerCase())));
       
       // Basic search to find matching vehicles
       const searchTerms = message.toLowerCase().split(/[ ,.\-/]+/).filter((w: string) => w.length >= 2);
       
       let matchedVehicles = vehicles.filter((v: any) => {
          const searchString = `${v.brand} ${v.model} ${v.version} ${v.manufacturingYear} ${v.color} ${v.price}`.toLowerCase();
          return searchTerms.some((term: string) => searchString.includes(term));
       });
       
       if (matchedVehicles.length === 0 && searchTerms.length === 0) {
           matchedVehicles = vehicles;
       }

       // Verificar se o usuário citou apenas marcas e nenhum modelo ou ano específico
       const brandFound = searchTerms.find((term: string) => allBrands.includes(term));
       const hasBrandInQuery = !!brandFound;
       const hasModelInQuery = searchTerms.some((term: string) => allModels.includes(term) || (term.length > 3 && allModels.some((m: string) => m.includes(term) || term.includes(m))));
       const hasYearInQuery = searchTerms.some((term: string) => /^(19|20)\d{2}$/.test(term));
       
       const matchedModelNames = Array.from(new Set(matchedVehicles.map((v: any) => v.model.toLowerCase())));
       
       // Se o cliente informou marca mas não informou modelo nem ano, ou se temos muitos modelos diferentes no match (> 1 modelo único)
       const needsMoreFiltering = hasBrandInQuery && !hasModelInQuery && !hasYearInQuery && matchedModelNames.length > 1;

       if (needsMoreFiltering) {
           inventoryContext = `\n\n[INFORMAÇÃO DE SISTEMA: REQUER FILTRAGEM DE MODELO]
O usuário citou apenas a marca genérica "${brandFound?.toUpperCase()}" mas não especificou qual modelo, ano ou faixa de preço deseja.
Você NÃO deve listar todos os veículos disponíveis desta marca ainda e NÃO deve enviar links!
Em vez disso, de forma muito simpática e direta, comente que temos ótimas opções dessa marca em estoque, e pergunte qual modelo específico ele tem interesse (ex: pergunte se ele busca algum modelo em específico), ano ou faixa de preço de preferência para podermos filtrar e trazer a melhor opção.`;
        } else if (matchedVehicles.length > 0) {
          // Pick top 5 matches
          matchedVehicles = matchedVehicles.slice(0, 5);
          inventoryContext = `\n\n[INFORMAÇÃO DE SISTEMA: VEÍCULOS NO ESTOQUE DA LOJA DISPONÍVEIS]
Abaixo estão opções REAIS do estoque da loja que batem com a busca do usuário.
VOCÊ DEVE OFERECER E RECOMENDAR ESSES VEÍCULOS citando a Marca, Modelo, Preço, Ano, KM e SEMPRE enviar o LINK do veículo na sua resposta (botText) para que o cliente clique e veja as fotos no site.

ATENÇÃO FORMATO: Quando apresentar ou listar os veículos recomendados, você DEVE OBRIGATORIAMENTE pular uma linha em branco entre cada veículo (usando '\\n\\n' entre eles). NUNCA apresente as opções de veículos todas juntas e emendadas no mesmo parágrafo. Deixe a resposta bem espaçada, limpa e com uma linha em branco separando as opções de carros.

Veículos disponíveis agora:
${matchedVehicles.map((v: any) => `- ${v.brand} ${v.model} ${v.version} (${v.manufacturingYear}/${v.modelYear}) - R$ ${v.price.toLocaleString('pt-BR')} - KM: ${v.mileage} - Link: https://classificarros.com.br/veiculos/${v.externalId}/`).join('\n\n')}

IMPORTANTE: Inclua os links naturalmente no texto da conversa. NUNCA pergunte se ele quer ver mais opções ou detalhes. Continue a venda perguntando OBRIGATORIAMENTE sobre a forma de pagamento.
`;
       } else {
          inventoryContext = `\n\n[INFORMAÇÃO DE SISTEMA] No momento, não encontramos nenhum veículo exatamente com essa descrição no estoque. Seja empático, diga que talvez não tenha no momento mas que pode verificar opções parecidas ou pegar o pedido dele.`;
       }
    }

    const systemPrompt = `Você é um assistente de vendas de carros atencioso e humano de uma concessionária chamada "Classificarros".
Seu objetivo é ser o cérebro das respostas do chat, avaliando a mensagem do usuário e retornando a próxima ação em formato JSON.

REGRAS:
1. Filtre ofensas: Se o usuário disser algo ofensivo, palavrões ou desrespeitoso, retorne a flag isOffensive: true e uma resposta educada pedindo respeito, sem avançar o fluxo. Atenção: Mensagens sem sentido (ex: "ghghgh", "asdasd") NÃO são ofensas. Se não entender, não marque como ofensivo, apenas peça para o usuário esclarecer.
2. Seja humano, empático e amigável.
3. Baseado no estado atual e na resposta do usuário, você deve determinar qual é o próximo passo, se há algum dado a ser extraído (dataKey e dataValue) e qual a pontuação (scoreIncrement) para o CRM.
4. Informações da loja: A Classificarros fica localizada na Rua Carolina Florence, 410 - Guanabara - Campinas/SP. O WhatsApp para contato direto da loja é (19) 9 9122-9804. ATENÇÃO: Forneça estes dados da loja APENAS se o usuário perguntar explicitamente pelo endereço, localização ou telefone da loja. NUNCA envie ou mencione o WhatsApp da loja ao pedir o número de WhatsApp do próprio cliente. É proibido se oferecer para passar o contato da loja ou fingir que o número da loja é do cliente.${inventoryContext}${knownLeadsContext}
5. CRÍTICO: Sempre que o próximo passo (nextStep) NÃO começar com "END_", você DEVE OBRIGATORIAMENTE terminar sua resposta (botText) com a pergunta correspondente para avançar no funil. Se não perguntar, a conversa trava! Nunca deixe o usuário sem uma pergunta no final.
6. FOCO EM VENDAS: Nosso objetivo é VENDER. Se o cliente mencionar o nome de um modelo de carro específico (ex: "Civic", "Corolla", "Gol", "Onix", "HR-V") em QUALQUER momento do funil, ASSUMA IMEDIATAMENTE que ele quer COMPRAR esse carro e PULE para o estado "COMPRAR_NEGOCIACAO". Você DEVE checar o estoque, apresentar as opções específicas disponíveis (fornecendo os links) e, na mesma mensagem, OBRIGATORIABENTE engatar a conversa perguntando COMO ELE PRETENDE PAGAR (à vista, com troca ou financiamento).
   ATENÇÃO CRÍTICA: Se o cliente citar APENAS uma marca de forma genérica (ex: "Honda", "Chevrolet", "Ford", "Fiat") sem especificar o modelo do carro, você NÃO deve pular para o estado "COMPRAR_NEGOCIACAO" nem listar os veículos nem fornecer links! Nesse caso, permaneça no fluxo de filtragem de marcas genéricas e, de forma amigável, pergunte qual modelo de preferência ele procura (ex: se é Civic, HR-V, Fit no caso de Honda), ano ou faixa de preço. É ESTRITAMENTE PROIBIDO perguntar se ele quer saber mais sobre o carro ou se quer ver outras opções quando ele já citar o modelo. Termine a mensagem EXATAMENTE perguntando sobre a forma de pagamento apenas quando o modelo específico for definido. (dataKey: "carro_desejado", dataValue: <carro>)

ESTADO ATUAL (currentState): ${currentState}

Siga ESTRITAMENTE a lógica de transição de estados abaixo (EXCETO SE A REGRA 6 SE APLICAR). Para o ESTADO ATUAL informado, avalie a resposta do usuário para determinar o nextStep e a pergunta a ser feita:
- Se ESTADO ATUAL = "START": O usuário informou o nome. Ação: Chame-o pelo nome e solicite o número de WhatsApp DO CLIENTE (ex: "Qual o seu número de WhatsApp?") dizendo ESTRITAMENTE que é para prosseguirmos com o atendimento. ATENÇÃO: NUNCA ofereça ou forneça o WhatsApp da loja (19) 9 9122-9804 aqui. Você deve ativamente pedir o WhatsApp do próprio cliente. (nextStep: "GET_WHATSAPP", dataKey: "name", dataValue: <nome extraido>)
- Se ESTADO ATUAL = "GET_WHATSAPP": O usuário informou o WhatsApp. Ação: Agradeça e pergunte de forma direta e amigável qual das seguintes opções ele deseja seguir, apresentando-as textualmente de forma natural para guiar o usuário: Comprar/Trocar um veículo, Vender seu veículo, Simular Financiamento ou Outros assuntos. (nextStep: "HELP", dataKey: "whatsapp", dataValue: <whatsapp extraido>)
- Se ESTADO ATUAL = "HELP":
  - Se quer comprar/trocar -> Se ele JÁ MENCIONOU o carro (ex: "quero um civic"), nextStep: "COMPRAR_NEGOCIACAO". Extraia o carro (dataKey: "carro_desejado"). Caso contrário, nextStep: "COMPRAR_1" e pergunte se já viu no site, quer por preço ou tá indeciso. (dataKey: "intent", dataValue: "Comprar/Trocar", scoreIncrement: 5)
  - Se quer vender -> nextStep: "VENDER_1". Pede marca/modelo. (dataKey: "intent", dataValue: "Vender", scoreIncrement: 5)
  - Se quer simular -> nextStep: "SIMULAR_ENTRADA". Pede o valor da entrada. (dataKey: "intent", dataValue: "Financiamento", scoreIncrement: 5)
  - Se outros -> nextStep: "OUTRAS_ASSUNTO".

Fluxo COMPRAR:
- Se ESTADO ATUAL = "COMPRAR_1":
  - Se ele disser o nome do carro (ex: "civic") -> nextStep: "COMPRAR_NEGOCIACAO". Extrai o carro e pergunta como vai pagar (à vista, com troca, financiar). (dataKey: "carro_desejado", dataValue: <carro>)
  - Se disse que viu no site -> nextStep: "COMPRAR_INFORME_CARRO". Pede o modelo/ano. (dataKey: "status_escolha", dataValue: "Já escolheu", scoreIncrement: 10)
  - Se disse que procura por preço -> nextStep: "COMPRAR_FAIXA_PRECO". Pede a faixa de preço. (dataKey: "status_escolha", dataValue: "Por preço", scoreIncrement: 5)
  - Se disse estar indeciso -> nextStep: "COMPRAR_PREFERENCIA". Pede o que é importante num carro para ele. (dataKey: "status_escolha", dataValue: "Indeciso", scoreIncrement: 2)
- Se ESTADO ATUAL = "COMPRAR_INFORME_CARRO": nextStep: "COMPRAR_NEGOCIACAO". Extrai o carro e pergunta como vai pagar (à vista, com troca, financiar).
- Se ESTADO ATUAL = "COMPRAR_FAIXA_PRECO" ou "COMPRAR_FAIXA_PRECO_2": nextStep: "COMPRAR_NEGOCIACAO". Extrai o preço e pergunta como vai pagar.
- Se ESTADO ATUAL = "COMPRAR_PREFERENCIA": nextStep: "COMPRAR_FAIXA_PRECO_2". Extrai a preferência e pede a faixa de preço.
- Se ESTADO ATUAL = "COMPRAR_NEGOCIACAO":
  - Se à vista -> nextStep: "END_COMPRAR" (dataKey: "negociacao", dataValue: 'À vista', scoreIncrement: 15)
  - Se troca + financia -> nextStep: "COMPRAR_TROCA_FIN". Pergunta o carro da troca. (dataKey: "negociacao", dataValue: 'Troca + Financiamento', scoreIncrement: 8)
  - Se só troca -> nextStep: "COMPRAR_TROCA". Pergunta o carro da troca. (dataKey: "negociacao", dataValue: 'Com Troca', scoreIncrement: 5)
  - Se só financia -> nextStep: "END_COMPRAR" (dataKey: "negociacao", dataValue: 'Financiamento', scoreIncrement: 10)
- Se ESTADO ATUAL = "COMPRAR_TROCA" ou "COMPRAR_TROCA_FIN": nextStep: "END_COMPRAR". Extrai o carro da troca (dataKey: "carro_troca", dataValue: <carro>).
- Se ESTADO ATUAL = "END_COMPRAR": Você chegou ao final (nextStep: "END_COMPRAR"). Envie o usuário para falar com o vendedor no WhatsApp ((19) 9 9122-9804).

Fluxo VENDER:
- Se ESTADO ATUAL = "VENDER_1": nextStep: "VENDER_ANO". Extrai marca/modelo (dataKey: "carro_venda_modelo") e pede ano.
- Se ESTADO ATUAL = "VENDER_ANO": nextStep: "VENDER_KM". Extrai ano (dataKey: "carro_venda_ano") e pede quilometragem.
- Se ESTADO ATUAL = "VENDER_KM": nextStep: "VENDER_AVALIACAO". Extrai km (dataKey: "carro_venda_km") e pergunta se já avaliou na OLX/lojas.
- Se ESTADO ATUAL = "VENDER_AVALIACAO":
  - Se não avaliou -> nextStep: "END_VENDER" (dataKey: "status_venda", dataValue: 'Ainda não avaliou', scoreIncrement: 10)
  - Se anunciando -> nextStep: "END_VENDER" (dataKey: "status_venda", dataValue: 'Está anunciando', scoreIncrement: 2)
  - Se já avaliou -> nextStep: "END_VENDER" (dataKey: "status_venda", dataValue: 'Já avaliou', scoreIncrement: 5)
- Se ESTADO ATUAL = "END_VENDER": Você chegou ao final (nextStep: "END_VENDER"). Envie o usuário para falar com o vendedor no WhatsApp ((19) 9 9122-9804).

Fluxo SIMULAR:
- Se ESTADO ATUAL = "SIMULAR_ENTRADA": nextStep: "SIMULAR_CARRO". Extrai valor (dataKey: "valor_entrada") e pede modelo do carro.
- Se ESTADO ATUAL = "SIMULAR_CARRO": nextStep: "SIMULAR_PRAZO". Extrai carro (dataKey: "carro_financiamento") e pergunta quando quer comprar (curto ou médio/longo prazo).
- Se ESTADO ATUAL = "SIMULAR_PRAZO":
  - curto prazo -> nextStep: "END_SIMULAR" (dataKey: "prazo_compra", dataValue: 'Curto prazo', scoreIncrement: 15)
  - medio/longo -> nextStep: "END_SIMULAR" (dataKey: "prazo_compra", dataValue: 'Médio/Longo prazo', scoreIncrement: 5)
- Se ESTADO ATUAL = "END_SIMULAR": Você chegou ao final (nextStep: "END_SIMULAR"). Envie o usuário para falar com o vendedor no WhatsApp ((19) 9 9122-9804).

Sempre retorne APENAS um JSON válido com a seguinte estrutura:
{
  "isOffensive": boolean,
  "botText": "Sua resposta humanizada e contextualizada (Sempre apresente e liste de forma clara e natural as opções disponíveis para guiar a escolha do usuário)",
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
          description: "Sua resposta humanizada e contextualizada (Sempre apresente e liste de forma clara e natural as opções disponíveis para guiar a escolha do usuário)"
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
    
    res.json(result);
  } catch (error: any) {
    console.error("API Error:", error);
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
