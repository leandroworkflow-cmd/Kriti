// Script pra criar a conta oficial "Kriti", usada como autora automática das
// provocações do dia (veja api/generate-provocation.js).
//
// COMO USAR (na pasta do projeto):
//   node --env-file=.env scripts/create-system-account.mjs
//
// Seu .env precisa ter:
//   VITE_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...  (Supabase > Project Settings > API > service_role)
//
// No final, o script imprime o UID que você deve colar na env var
// KRITI_SYSTEM_USER_ID na Vercel.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

globalThis.WebSocket = WebSocket;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar (ex: no seu .env).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EMAIL = "oficial@kriti.local";
const DISPLAY_NAME = "Kriti";
const USERNAME = "kriti";

async function run() {
  console.log("Criando conta oficial da Kriti...");

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    password: randomUUID(),
    user_metadata: { full_name: DISPLAY_NAME },
  });

  let userId;

  if (userError) {
    if (userError.message?.includes("already been registered")) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        console.error("Erro ao buscar usuário existente:", listError.message);
        process.exit(1);
      }
      const existing = listData.users.find((u) => u.email === EMAIL);
      if (!existing) {
        console.error("Usuário dizia existir mas não foi encontrado.");
        process.exit(1);
      }
      userId = existing.id;
      console.log("(conta já existia, reaproveitando)");
    } else {
      console.error("Erro ao criar usuário:", userError.message);
      process.exit(1);
    }
  } else {
    userId = userData.user.id;
  }

  // Completa (ou atualiza) o perfil, e já marca como aprovada no teste
  // cognitivo, já que essa conta não precisa passar pelo teste de verdade.
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      display_name: DISPLAY_NAME,
      username: USERNAME,
      bio: "Conta oficial da Kriti — publica a provocação do dia.",
      test_passed: true,
      verified: true,
    })
    .eq("user_id", userId);

  if (profileError) {
    console.error("Erro ao atualizar o perfil:", profileError.message);
    process.exit(1);
  }

  console.log("\nConta oficial pronta!");
  console.log("Cole este valor na variável de ambiente KRITI_SYSTEM_USER_ID na Vercel:\n");
  console.log(userId);
}

run();
