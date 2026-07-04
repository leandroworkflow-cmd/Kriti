-- ============================================================================
-- KRITI — Schema completo do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Painel do Supabase > SQL Editor > New query > cole tudo > Run)
-- ============================================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists pgcrypto;

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

-- Cria automaticamente uma linha em "profiles" sempre que alguém se cadastra
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Impede que o próprio usuário mude seu "role" via update comum
-- (promoção a admin só pode ser feita manualmente aqui no SQL Editor)
create or replace function prevent_role_self_update()
returns trigger as $$
begin
  new.role = old.role;
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
  is_repost boolean not null default false,
  original_post_id uuid,
  original_author_name text,
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
-- 5. COMMENTS
-- ============================================================================
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_username text,
  author_avatar text,
  content text not null,
  created_date timestamptz not null default now()
);

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
-- 10. PARA SE TORNAR ADMIN (rode manualmente, trocando o e-mail):
-- ============================================================================
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'seu-email@exemplo.com');
