// Vercel Serverless Function — avalia a qualidade intelectual de um post
// usando a Groq, em 5 eixos (Clareza, Originalidade, Fontes, Rigor, Impacto).
// Chamada uma vez, no momento em que o post é publicado.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
  }

  const { title, content } = req.body || {};
  if (!content || content.trim().length < 20) {
    // Posts muito curtos não são avaliados (não há substância suficiente)
    return res.status(200).json({ scored: false });
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
              "Você avalia a qualidade intelectual de textos curtos publicados em uma rede social de debate. " +
              "Dê uma nota de 0 a 10 (pode usar uma casa decimal) para cada um destes 5 critérios: " +
              "clareza (facilidade de entender o argumento), originalidade (o quanto foge do óbvio/clichê), " +
              "fontes (se cita ou se apoia em evidências/referências concretas, não apenas opinião), " +
              "rigor (solidez lógica do raciocínio) e impacto (o quanto gera reflexão real). " +
              "Seja um avaliador rigoroso: a maioria dos textos curtos e sem fontes deve ficar na faixa 4-7, " +
              "não dê notas altas por padrão. " +
              'Responda APENAS com um JSON válido: {"clareza":0,"originalidade":0,"fontes":0,"rigor":0,"impacto":0}. ' +
              "Nenhum texto fora do JSON.",
          },
          {
            role: "user",
            content: `Título: ${title || "(sem título)"}\n\nTexto:\n${content}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);
      return res.status(502).json({ error: "Falha ao avaliar o post" });
    }

    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    const clamp = (n) => Math.max(0, Math.min(10, Number(n) || 0));
    const scores = {
      clarity_score: clamp(parsed.clareza),
      originality_score: clamp(parsed.originalidade),
      sources_score: clamp(parsed.fontes),
      rigor_score: clamp(parsed.rigor),
      impact_score: clamp(parsed.impacto),
    };
    const overall = (
      scores.clarity_score + scores.originality_score + scores.sources_score + scores.rigor_score + scores.impact_score
    ) / 5;

    return res.status(200).json({ scored: true, ...scores, overall_score: Math.round(overall * 10) / 10 });
  } catch (err) {
    console.error("Erro ao avaliar post:", err);
    return res.status(500).json({ error: "Erro interno ao avaliar o post" });
  }
}
