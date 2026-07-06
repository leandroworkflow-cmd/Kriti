-- ============================================================================
-- KRITI — Schema completo do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Painel do Supabase > SQL Editor > New query > cole tudo > Run)
-- ============================================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================================
-- GRANTS — permissões de acesso às tabelas (separadas das políticas de RLS!)
-- O RLS controla QUAIS linhas um usuário pode ver; o GRANT controla se ele
-- pode sequer consultar a tabela. Sem isso, toda consulta retorna 403.
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;

-- ============================================================================
-- 1. PROFILES — dados de sistema ligados 1:1 ao auth.users (papel/role)
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_date timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Qualquer usuário autenticado pode ver perfis (role)"
  on profiles for select
  to authenticated
  using (true);

-- Cria automaticamente uma linha em "profiles" e outra em "user_profiles"
-- sempre que alguém se cadastra (login comum ou Google) — assim toda conta
-- já nasce com um perfil completo, mesmo administradores que pulam o teste de QI.
create or replace function handle_new_user()
returns trigger as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  insert into public.profiles (id, role) values (new.id, 'user');

  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  if base_username is null or base_username = '' then
    base_username := 'usuario';
  end if;
  final_username := base_username;

  -- Garante um username único, adicionando um número se já existir
  while exists (select 1 from public.user_profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.user_profiles (user_id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    final_username
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Impede que o próprio usuário mude seu "role" via update feito pelo app
-- (usando a chave anon/authenticated). Atualizações manuais pelo SQL Editor
-- ou via service_role continuam funcionando normalmente.
create or replace function prevent_role_self_update()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    new.role = old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_role_self_update on profiles;
create trigger trg_prevent_role_self_update
  before update on profiles
  for each row execute function prevent_role_self_update();

-- ============================================================================
-- 2. USER_PROFILES — perfil público do app (era "UserProfile" no Base44)
-- ============================================================================
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null unique,
  bio text,
  avatar_url text,
  cover_url text,
  verified boolean not null default false,
  iq_score numeric,
  test_passed boolean not null default false,
  test_taken_at timestamptz,
  test_attempts numeric not null default 0,
  test_window_started_at text, -- chave do mês-calendário, ex: "2026-07"
  banned boolean not null default false,
  ban_reason text,
  banned_at timestamptz,
  followers_count numeric not null default 0,
  following_count numeric not null default 0,
  posts_count numeric not null default 0,
  created_date timestamptz not null default now()
);

create index if not exists idx_user_profiles_user_id on user_profiles(user_id);
create unique index if not exists idx_user_profiles_user_id_unique on user_profiles(user_id);
create index if not exists idx_user_profiles_username on user_profiles(username);

alter table user_profiles enable row level security;

create policy "Qualquer autenticado pode ver perfis"
  on user_profiles for select
  to authenticated
  using (true);

create policy "Usuário cria seu próprio perfil"
  on user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuário edita seu próprio perfil, ou admin edita qualquer um"
  on user_profiles for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================================
-- 3. POSTS (feed principal)
-- ============================================================================
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_username text,
  author_avatar text,
  content text not null,
  image_url text,
  likes_count numeric not null default 0,
  comments_count numeric not null default 0,
  reposts_count numeric not null default 0,
  views_count numeric not null default 0,
  is_repost boolean not null default false,
  original_post_id uuid references posts(id) on delete set null,
  original_author_name text,
  original_author_username text,
  original_author_avatar text,
  original_content text,
  original_image_url text,
  forum_category text check (forum_category in ('general','medicina','politica','tecnologia','arte','economia')),
  created_date timestamptz not null default now()
);

create index if not exists idx_posts_author_id on posts(author_id);
create index if not exists idx_posts_created_date on posts(created_date desc);

alter table posts enable row level security;

create policy "Qualquer autenticado pode ver posts"
  on posts for select to authenticated using (true);

create policy "Usuário cria seus próprios posts"
  on posts for insert to authenticated with check (auth.uid() = author_id);

create policy "Usuário edita seus próprios posts"
  on posts for update to authenticated using (auth.uid() = author_id);

create policy "Usuário apaga seus próprios posts, ou admin apaga qualquer um"
  on posts for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================================
-- 4. POST_LIKES
-- ============================================================================
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table post_likes enable row level security;

create policy "Qualquer autenticado pode ver likes"
  on post_likes for select to authenticated using (true);

create policy "Usuário cria seus próprios likes"
  on post_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "Usuário remove seus próprios likes"
  on post_likes for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- 4.5 POST_BOOKMARKS (posts salvos)
-- ============================================================================
create table if not exists post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table post_bookmarks enable row level security;

create policy "Usuário vê apenas seus próprios bookmarks"
  on post_bookmarks for select to authenticated using (auth.uid() = user_id);

create policy "Usuário cria seus próprios bookmarks"
  on post_bookmarks for insert to authenticated with check (auth.uid() = user_id);

create policy "Usuário remove seus próprios bookmarks"
  on post_bookmarks for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_username text,
  author_avatar text,
  content text not null,
  created_date timestamptz not null default now()
);

create index if not exists idx_comments_parent_comment_id on comments(parent_comment_id);

create index if not exists idx_comments_post_id on comments(post_id);

alter table comments enable row level security;

create policy "Qualquer autenticado pode ver comentários"
  on comments for select to authenticated using (true);

create policy "Usuário cria seus próprios comentários"
  on comments for insert to authenticated with check (auth.uid() = author_id);

create policy "Usuário apaga seus próprios comentários, ou admin apaga qualquer um"
  on comments for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================================
-- 6. FOLLOWS
-- ============================================================================
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  unique (follower_id, following_id)
);

alter table follows enable row level security;

create policy "Qualquer autenticado pode ver follows"
  on follows for select to authenticated using (true);

create policy "Usuário cria seus próprios follows"
  on follows for insert to authenticated with check (auth.uid() = follower_id);

create policy "Usuário remove seus próprios follows"
  on follows for delete to authenticated using (auth.uid() = follower_id);

-- ============================================================================
-- 7. FORUM_THREADS
-- ============================================================================
create table if not exists forum_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null check (category in ('medicina','politica','tecnologia','arte','economia')),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_username text,
  author_avatar text,
  replies_count numeric not null default 0,
  likes_count numeric not null default 0,
  pinned boolean not null default false,
  created_date timestamptz not null default now()
);

create index if not exists idx_forum_threads_category on forum_threads(category);

alter table forum_threads enable row level security;

create policy "Qualquer autenticado pode ver tópicos"
  on forum_threads for select to authenticated using (true);

create policy "Usuário cria seus próprios tópicos"
  on forum_threads for insert to authenticated with check (auth.uid() = author_id);

create policy "Usuário edita seus próprios tópicos, ou admin edita qualquer um"
  on forum_threads for update to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Usuário apaga seus próprios tópicos, ou admin apaga qualquer um"
  on forum_threads for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================================
-- 8. FORUM_REPLIES
-- ============================================================================
create table if not exists forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_username text,
  author_avatar text,
  content text not null,
  created_date timestamptz not null default now()
);

create index if not exists idx_forum_replies_thread_id on forum_replies(thread_id);

alter table forum_replies enable row level security;

create policy "Qualquer autenticado pode ver respostas"
  on forum_replies for select to authenticated using (true);

create policy "Usuário cria suas próprias respostas"
  on forum_replies for insert to authenticated with check (auth.uid() = author_id);

create policy "Usuário apaga suas próprias respostas, ou admin apaga qualquer uma"
  on forum_replies for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================================
-- 9. STORAGE — bucket para avatares e imagens de posts
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "Leitura pública dos arquivos enviados"
  on storage.objects for select
  using (bucket_id = 'uploads');

create policy "Usuário autenticado pode enviar arquivos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'uploads');

create policy "Usuário autenticado pode atualizar seus arquivos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'uploads');

-- ============================================================================
-- 11. RANKING "EM ALTA" — engajamento inteligente em vez de volume bruto
-- Pesos: profundidade de conversa > diversidade de participantes > bookmarks
-- > reposts > curtidas (o sinal mais fraco, de propósito).
-- ============================================================================
create or replace function get_trending_posts(days_back int default 3, max_results int default 50)
returns setof posts
language sql
stable
as $$
  select p.*
  from posts p
  left join (
    select
      c.post_id,
      count(distinct c.author_id) as unique_commenters,
      count(*) filter (
        where exists (select 1 from comments r where r.parent_comment_id = c.id)
      ) as replied_comments
    from comments c
    group by c.post_id
  ) cstats on cstats.post_id = p.id
  left join (
    select post_id, count(*) as bookmark_count
    from post_bookmarks
    group by post_id
  ) bstats on bstats.post_id = p.id
  where p.forum_category = 'general'
    and p.created_date > now() - (days_back || ' days')::interval
  order by (
    coalesce(cstats.unique_commenters, 0) * 3
    + coalesce(cstats.replied_comments, 0) * 5
    + coalesce(bstats.bookmark_count, 0) * 4
    + coalesce(p.reposts_count, 0) * 2
    + coalesce(p.likes_count, 0) * 1
  ) desc, p.created_date desc
  limit max_results;
$$;

grant execute on function get_trending_posts(int, int) to authenticated;

-- ============================================================================
-- 12. PARA SE TORNAR ADMIN (rode manualmente, trocando o e-mail):
-- ============================================================================
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'seu-email@exemplo.com');
