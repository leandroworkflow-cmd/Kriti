// Vercel Serverless Function — exclui definitivamente a conta do usuário autenticado
// (auth.users + tudo que está em cascata: perfil, posts, comentários, curtidas, etc.)
// Usa a Service Role Key do Supabase, que SÓ existe aqui no servidor — nunca no navegador.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Configuração do servidor incompleta" });
  }

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.replace("Bearer ", "");
  if (!accessToken) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    // Verifica quem é o usuário dono desse token (usando o próprio token, não a service key)
    const supabaseAsUser = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await supabaseAsUser.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    const userId = userData.user.id;

    // Deleta o usuário do sistema de autenticação — os "on delete cascade"
    // do banco cuidam de apagar profiles, user_profiles, posts, comments, etc.
    const { error: deleteError } = await supabaseAsUser.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Erro ao deletar usuário:", deleteError);
      return res.status(500).json({ error: "Falha ao excluir a conta" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return res.status(500).json({ error: "Erro interno ao excluir a conta" });
  }
}
