import { supabase } from "@/lib/supabaseClient";

// Mapeia os nomes de "entidades" no estilo Base44 para as tabelas reais no Postgres/Supabase
const TABLE_MAP = {
  UserProfile: "user_profiles",
  Post: "posts",
  PostLike: "post_likes",
  PostReaction: "post_reactions",
  PostBookmark: "post_bookmarks",
  Comment: "comments",
  Follow: "follows",
  ForumThread: "forum_threads",
  ForumReply: "forum_replies",
  TentativaTeste: "tentativas_teste",
};

// Aplica um sort no estilo Base44 ("-created_date" = desc, "created_date" = asc)
function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith("-");
  const column = desc ? sort.slice(1) : sort;
  return query.order(column, { ascending: !desc });
}

function createEntity(tableName) {
  return {
    async filter(match = {}, sort, limit) {
      let query = supabase.from(tableName).select("*").match(match);
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async list(sort, limit) {
      return createEntity(tableName).filter({}, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase.from(tableName).select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(tableName).update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    },
  };
}

const entities = new Proxy(
  {},
  {
    get(_target, entityName) {
      const tableName = TABLE_MAP[entityName];
      if (!tableName) {
        throw new Error(`[Kriti] Entidade desconhecida: "${String(entityName)}". Adicione o mapeamento em src/lib/db.js`);
      }
      return createEntity(tableName);
    },
  }
);

const auth = {
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  // Retorna { id, email, full_name, role }, equivalente ao antigo db.auth.me() do Base44
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      role: profile?.role || "user",
    };
  },

  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  loginWithProvider(provider, redirectPath = "/") {
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
  },

  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  // Confirma o cadastro via código de 6 dígitos enviado por e-mail
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "signup",
    });
    if (error) throw error;
    return { access_token: data?.session?.access_token };
  },

  // No-op: o supabase-js já gerencia a sessão internamente (localStorage)
  setToken() {},

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  // Após clicar no link do e-mail, o Supabase já autentica numa sessão de "recovery";
  // só precisamos atualizar a senha do usuário logado nessa sessão.
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async logout(redirectTo) {
    await supabase.auth.signOut();
    if (redirectTo) {
      window.location.href = typeof redirectTo === "string" ? redirectTo : "/login";
    }
  },

  // Exclui definitivamente a conta do usuário logado (LGPD, direito ao esquecimento)
  async deleteAccount() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || "Falha ao excluir a conta");
    }

    await supabase.auth.signOut();
    return res.json();
  },

  redirectToLogin() {
    window.location.href = "/login";
  },
};

const integrations = {
  Core: {
    // Faz upload de um arquivo para o Storage do Supabase (bucket "uploads") e retorna a URL pública
    async UploadFile({ file }) {
      const ext = file.name?.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      return { file_url: data.publicUrl };
    },

    // Gera as perguntas do teste de QI via função serverless (Vercel) que chama a Groq
    async InvokeLLM({ prompt, response_json_schema }) {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, response_json_schema }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Falha ao gerar perguntas");
      }
      return res.json();
    },
  },
};

export const db = { auth, entities, integrations };

// Chama uma função do Postgres criada no Supabase (ex: get_trending_posts)
db.rpc = async (functionName, params = {}) => {
  const { data, error } = await supabase.rpc(functionName, params);
  if (error) throw error;
  return data;
};
