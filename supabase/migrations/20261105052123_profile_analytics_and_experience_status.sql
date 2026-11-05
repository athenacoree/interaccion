create table public.profile_visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visitor_key uuid not null,
  visited_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (profile_id, visitor_key, visited_on)
);
create index profile_visits_profile_date_idx on public.profile_visits(profile_id, visited_on desc);
alter table public.profile_visits enable row level security;
grant insert on public.profile_visits to anon, authenticated;
grant select on public.profile_visits to authenticated;
create policy "Public profiles can receive visit counts" on public.profile_visits
for insert to anon, authenticated
with check (exists (select 1 from public.profiles p where p.id = profile_id and p.is_public = true));
create policy "Owners read their profile visits" on public.profile_visits
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = profile_id and p.id = (select auth.uid())));

create table public.experience_events (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  visitor_key uuid not null,
  event_type text not null check (event_type in ('view','response')),
  event_day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (experience_id, visitor_key, event_type, event_day)
);
create index experience_events_experience_date_idx on public.experience_events(experience_id, event_day desc);
alter table public.experience_events enable row level security;
grant insert on public.experience_events to anon, authenticated;
grant select on public.experience_events to authenticated;
create policy "Visitors track public experience activity" on public.experience_events
for insert to anon, authenticated
with check (exists (select 1 from public.experiences e where e.id = experience_id and e.is_public = true and e.status = 'published'));
create policy "Owners read their experience activity" on public.experience_events
for select to authenticated
using (exists (select 1 from public.experiences e where e.id = experience_events.experience_id and e.owner_id = (select auth.uid())));

alter table public.experiences drop constraint if exists experiences_status_check;
alter table public.experiences add constraint experiences_status_check
check (status in ('draft','published','paused','archived'));
