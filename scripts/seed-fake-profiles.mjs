// Script pra criar os perfis de demonstração da Kriti.
//
// STATUS ATUAL:
//   ✅ analuizamarques.jpg      (já está em ./seed-photos/)
//   ✅ giovannaloriette.jpg     (já está em ./seed-photos/)
//   ⏳ marcoslambrucci.jpg      (ainda não gerada — perfil sai sem foto por enquanto)
//   ⏳ samaragodoguinotto.jpg   (ainda não gerada — perfil sai sem foto por enquanto)
//   ⏳ samaragodoguinotto-post.jpg (foto do evento de Medicina, opcional, pode vir depois)
//
// Pode rodar assim mesmo agora — quem não tem foto ainda fica sem avatar, e
// você adiciona depois direto pelo app (ícone de câmera no perfil) ou rodando
// este script de novo depois de colocar os arquivos que faltam na pasta
// ./seed-photos/ (ele não duplica quem já foi criado, só ignora e mostra erro
// de "already exists" pra esses).
//
// COMO USAR:
// 1. (Opcional) Coloque fotos que faltam em ./seed-photos/ com esses nomes exatos.
// 2. Rode (na pasta do projeto):
//      node --env-file=.env scripts/seed-fake-profiles.mjs
//
//    Seu .env precisa ter, além do resto:
//      SUPABASE_SERVICE_ROLE_KEY=... (pegue em Supabase > Project Settings > API > service_role)
//
// Esse script usa a service_role key, que tem acesso total ao banco — nunca
// coloque esse arquivo/chave em nenhum lugar público.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

// O supabase-js tenta inicializar um cliente de Realtime (que a gente nem usa
// aqui) e isso exige WebSocket nativo, só disponível a partir do Node 22.
// Esse polyfill resolve pra quem está no Node 20 sem precisar atualizar nada.
globalThis.WebSocket = WebSocket;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar (ex: no seu .env).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PROFILES = [
  {
    email: "ana.luiza.marques.seed@kriti.local",
    display_name: "Ana Luiza Marques",
    username: "analuizamarques",
    iq_score: 140,
    bio: "Filósofa por formação, cética por natureza.",
    posts: [
      "A dúvida não é o oposto do conhecimento — é o motor dele. Quem para de duvidar, para de pensar.",
      "Estoicismo não é sobre não sentir. É sobre não deixar o que você sente decidir o que você faz.",
    ],
  },
  {
    email: "marcos.lambrucci.seed@kriti.local",
    display_name: "Marcos Antônio Lambrucci",
    username: "marcoslambrucci",
    iq_score: 120,
    bio: "Engenheiro, curioso por sistemas complexos.",
    posts: [
      "Quanto mais um sistema tenta prever o comportamento humano, mais ele muda o comportamento que tentava prever. Vale pra economia, pra redes sociais e pra qualquer IA de recomendação.",
    ],
  },
  {
    email: "giovanna.loriette.seed@kriti.local",
    display_name: "Giovanna Loriette",
    username: "giovannaloriette",
    iq_score: 132,
    bio: "Leitora compulsiva. Sempre com um livro na bolsa.",
    posts: [
      '"Você tem poder sobre sua mente, não sobre eventos externos. Perceba isso, e encontrará força." — Marco Aurélio, Meditações',
    ],
  },
  {
    email: "samara.godoguinotto.seed@kriti.local",
    display_name: "Samara Godoguinotto",
    username: "samaragodoguinotto",
    iq_score: 128,
    bio: "Medicina. Sempre em busca de uma boa discussão baseada em evidência.",
    posts: [
      { text: "Ótimo congresso essa semana — trocar ideia presencialmente com quem também vive a rotina clínica é insubstituível.", useEventPhoto: true },
    ],
  },
];

async function uploadPhoto(filename, storageKey) {
  const filePath = path.join("./seed-photos", filename);
  if (!fs.existsSync(filePath)) return null;

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).slice(1) || "jpg";
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  const { error } = await supabase.storage.from("uploads").upload(`${storageKey}.${ext}`, fileBuffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error(`  Erro no upload de ${filename}:`, error.message);
    return null;
  }
  const { data } = supabase.storage.from("uploads").getPublicUrl(`${storageKey}.${ext}`);
  return data.publicUrl;
}

async function run() {
  for (const p of PROFILES) {
    console.log(`\nCriando ${p.display_name}...`);

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: p.email,
      email_confirm: true,
      password: randomUUID(),
      user_metadata: { full_name: p.display_name },
    });

    let userId;

    if (userError) {
      if (userError.message?.includes("already been registered")) {
        // Já existe de uma tentativa anterior — reaproveita a conta em vez de falhar
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (listError) {
          console.error(`  Erro ao buscar usuário existente: ${listError.message}`);
          continue;
        }
        const existing = listData.users.find((u) => u.email === p.email);
        if (!existing) {
          console.error("  Usuário dizia existir mas não foi encontrado — pulando.");
          continue;
        }
        userId = existing.id;
        console.log("  (conta já existia, completando os dados dela)");
      } else {
        console.error(`  Erro ao criar usuário: ${userError.message}`);
        continue;
      }
    } else {
      userId = userData.user.id;
    }
    const avatarUrl = await uploadPhoto(`${p.username}.jpg`, `${userId}-avatar`);

    // O gatilho handle_new_user() já criou uma linha básica em user_profiles
    // assim que o usuário foi criado acima — aqui só completamos ela.
    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({
        display_name: p.display_name,
        username: p.username,
        bio: p.bio,
        avatar_url: avatarUrl,
        iq_score: p.iq_score,
        test_passed: true,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error(`  Erro ao criar perfil: ${profileError.message}`);
      continue;
    }

    // Marca automaticamente como conta de povoamento, pra nunca mais precisar
    // filtrar isso na mão depois.
    const { error: fakeFlagError } = await supabase
      .from("contas_fake")
      .upsert({ user_id: userId, motivo: "conta de povoamento (seed)" });
    if (fakeFlagError) {
      console.error(`  Erro ao marcar como conta fake: ${fakeFlagError.message}`);
    }

    const { count: existingPostsCount } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId);

    if (existingPostsCount > 0) {
      console.log(`  Já tem ${existingPostsCount} post(s) — não vou duplicar.`);
    } else {
      for (const post of p.posts) {
        const isObj = typeof post === "object";
        const content = isObj ? post.text : post;
        let imageUrl = null;
        if (isObj && post.useEventPhoto) {
          imageUrl = (await uploadPhoto(`${p.username}-post.jpg`, `${userId}-post`)) || avatarUrl;
        }
        const { error: postError } = await supabase.from("posts").insert({
          author_id: userId,
          author_name: p.display_name,
          author_username: p.username,
          author_avatar: avatarUrl,
          content,
          image_url: imageUrl,
          forum_category: "general",
        });
        if (postError) console.error("  Erro ao criar post:", postError.message);
      }
    }

    console.log(`  OK — QI ${p.iq_score}, ${p.posts.length} post(s), foto: ${avatarUrl ? "sim" : "não"}`);
  }

  console.log("\nConcluído! Os 4 perfis já aparecem no feed da Kriti.");
}

run();
