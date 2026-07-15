// Vercel Serverless Function — analisa um projeto do Kriti Labs via Groq:
// gera resumo executivo, pontos fortes/fracos, e organiza a descrição livre
// num Lean Canvas estruturado.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
  }

  const { name, area, stage, description, seeking } = req.body || {};
  if (!name || !description) {
    return res.status(400).json({ error: "Campos 'name' e 'description' são obrigatórios" });
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista de negócios experiente, avaliando projetos/startups em estágio inicial " +
              "para uma plataforma de conexão entre empreendedores e investidores. Seja honesto e direto — " +
              "não infle elogios, aponte fraquezas reais mesmo que o projeto pareça bom. Baseie-se SOMENTE " +
              "nas informações fornecidas; quando uma informação não foi dada, escreva explicitamente que " +
              "'não foi informado' no campo do canvas em vez de inventar. " +
              "Responda APENAS com um JSON válido neste formato exato:\n" +
              '{"resumo_executivo":"...", "pontos_fortes":["...","..."], "pontos_fracos":["...","..."], ' +
              '"canvas":{"problema":"...","solucao":"...","mercado":"...","clientes":"...","receita":"...",' +
              '"tecnologia":"...","equipe":"...","investimento":"...","roadmap":"..."}}\n' +
              "Nenhum texto fora do JSON.",
          },
          {
            role: "user",
            content:
              `Nome do projeto: ${name}\n` +
              `Área: ${area || "não informado"}\n` +
              `Estágio: ${stage || "não informado"}\n` +
              `Buscando: ${seeking || "não informado"}\n\n` +
              `Descrição fornecida pelo criador:\n${description}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);
      return res.status(502).json({ error: "Falha ao analisar o projeto" });
    }

    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return res.status(200).json({
      ai_summary: parsed.resumo_executivo || "",
      ai_strengths: Array.isArray(parsed.pontos_fortes) ? parsed.pontos_fortes.join("\n") : "",
      ai_weaknesses: Array.isArray(parsed.pontos_fracos) ? parsed.pontos_fracos.join("\n") : "",
      canvas_problem: parsed.canvas?.problema || "",
      canvas_solution: parsed.canvas?.solucao || "",
      canvas_market: parsed.canvas?.mercado || "",
      canvas_customers: parsed.canvas?.clientes || "",
      canvas_revenue: parsed.canvas?.receita || "",
      canvas_technology: parsed.canvas?.tecnologia || "",
      canvas_team: parsed.canvas?.equipe || "",
      canvas_investment: parsed.canvas?.investimento || "",
      canvas_roadmap: parsed.canvas?.roadmap || "",
    });
  } catch (err) {
    console.error("Erro ao analisar projeto:", err);
    return res.status(500).json({ error: "Erro interno ao analisar o projeto" });
  }
}
