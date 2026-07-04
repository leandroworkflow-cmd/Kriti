// Vercel Serverless Function — gera perguntas do teste de QI usando a Groq.
// A chave da API fica só aqui no servidor (variável de ambiente GROQ_API_KEY),
// nunca é exposta no navegador.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });
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
              "Você gera perguntas de teste de QI em português brasileiro. " +
              "Responda APENAS com um JSON válido no formato " +
              '{"questions":[{"question":"...","options":["...","...","...","..."],"correct_index":0}]}. ' +
              "Não inclua nenhum texto fora do JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);
      return res.status(502).json({ error: "Falha ao gerar perguntas com a IA" });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.questions)) {
      return res.status(502).json({ error: "Resposta da IA em formato inesperado" });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Erro ao chamar a Groq:", err);
    return res.status(500).json({ error: "Erro interno ao gerar perguntas" });
  }
}
