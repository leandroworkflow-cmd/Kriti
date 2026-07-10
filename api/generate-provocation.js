// Vercel Serverless Function — gera a "provocação do dia" com a Groq e publica
// como um post fixado, criado pela conta oficial da Kriti.
//
// Protegida por CRON_SECRET: só o próprio agendamento da Vercel (ou você, na mão)
// pode chamar essa rota — senão qualquer um poderia gerar posts sem parar.
//
// Variáveis de ambiente necessárias:
//   GROQ_API_KEY               (já existe, usada pelo generate-quiz)
//   SUPABASE_SERVICE_ROLE_KEY  (já existe, usada pelo delete-account)
//   VITE_SUPABASE_URL          (já existe)
//   KRITI_SYSTEM_USER_ID       (novo — id do usuário "Kriti Oficial", ver nota abaixo)
//   CRON_SECRET                (novo — qualquer string aleatória só sua)

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const systemUserId = process.env.KRITI_SYSTEM_USER_ID;

  if (!groqKey || !supabaseUrl || !serviceRoleKey || !systemUserId) {
    return res.status(500).json({ error: "Configuração do servidor incompleta" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Evita gerar duas provocações no mesmo dia se o cron rodar de novo
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("is_provocation", true)
      .gte("created_date", startOfDay.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ skipped: true, reason: "Já existe provocação hoje" });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Você cria uma única pergunta provocativa e instigante em português brasileiro, " +
              "sobre filosofia, ciência, comportamento humano ou sociedade. Deve gerar reflexão " +
              "e opiniões divergentes, sem ser ofensiva, partidária ou clickbait vazio. " +
              'Responda APENAS com JSON: {"question": "..."}.',
          },
          { role: "user", content: `Gere uma provocação nova e original. Timestamp: ${Date.now()}` },
        ],
        response_format: { type: "json_object" },
        temperature: 1,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);
      return res.status(502).json({ error: "Falha ao gerar a provocação com a IA" });
    }

    const groqData = await groqRes.json();
    const parsed = JSON.parse(groqData.choices?.[0]?.message?.content || "{}");
    if (!parsed.question) {
      return res.status(502).json({ error: "Resposta da IA em formato inesperado" });
    }

    const { data: newPost, error: insertError } = await supabase
      .from("posts")
      .insert({
        author_id: systemUserId,
        author_name: "Kriti",
        author_username: "kriti",
        content: parsed.question,
        forum_category: "general",
        is_provocation: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir provocação:", insertError);
      return res.status(500).json({ error: "Falha ao publicar a provocação" });
    }

    return res.status(200).json({ success: true, post: newPost });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return res.status(500).json({ error: "Erro interno ao gerar a provocação" });
  }
}
