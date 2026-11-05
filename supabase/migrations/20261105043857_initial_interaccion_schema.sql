-- Interacción initial schema. Applied to project wlbnulfixkfmvcifvpum.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60)
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  kind text not null check (kind in ('know_me','confession','comparison','poll','quiz')),
  title text not null,
  description text not null default '',
  cover_url text,
  is_public boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiences_slug_format check (slug ~ '^[a-z0-9-]{3,60}$'),
  constraint experiences_title_length check (char_length(title) between 1 and 100)
);

create table public.experience_questions (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  position integer not null default 0,
  prompt text not null,
  answer_type text not null default 'single_choice'
    check (answer_type in ('single_choice','multiple_choice','text','image_choice','rating')),
  options jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint experience_questions_prompt_length check (char_length(prompt) between 1 and 500)
);

create table public.experience_entries (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  respondent_id uuid references auth.users(id) on delete set null,
  respondent_name text,
  is_anonymous boolean not null default true,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index experiences_owner_created_idx on public.experiences(owner_id, created_at desc);
create index experiences_public_slug_idx on public.experiences(slug) where is_public and status = 'published';
create index experience_questions_experience_position_idx on public.experience_questions(experience_id, position);
create index experience_entries_experience_created_idx on public.experience_entries(experience_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.experiences enable row level security;
alter table public.experience_questions enable row level security;
alter table public.experience_entries enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, update, delete on public.experiences to authenticated;
grant select on public.experiences to anon;
grant select, insert, update, delete on public.experience_questions to authenticated;
grant select on public.experience_questions to anon;
grant select, insert on public.experience_entries to anon, authenticated;

create policy "Public profiles are visible" on public.profiles
for select to anon, authenticated using (is_public or (select auth.uid()) = id);
create policy "Users create their own profile" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update their own profile" on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Public published experiences are visible" on public.experiences
for select to anon, authenticated
using ((is_public and status = 'published') or owner_id = (select auth.uid()));
create policy "Owners create experiences" on public.experiences
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update experiences" on public.experiences
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "Owners delete experiences" on public.experiences
for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Questions for public experiences are visible" on public.experience_questions
for select to anon, authenticated using (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.is_public and e.status = 'published')
  or exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
);
create policy "Owners add questions" on public.experience_questions
for insert to authenticated with check (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
);
create policy "Owners update questions" on public.experience_questions
for update to authenticated using (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
);
create policy "Owners delete questions" on public.experience_questions
for delete to authenticated using (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
);

create policy "Visitors submit to public experiences" on public.experience_entries
for insert to anon, authenticated with check (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.is_public and e.status = 'published')
);
create policy "Owners read entries for their experiences" on public.experience_entries
for select to authenticated using (
  exists (select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid()))
);
