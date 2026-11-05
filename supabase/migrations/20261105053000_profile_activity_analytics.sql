-- Daily, privacy-preserving profile and experience visit analytics.
create table if not exists public.profile_activity (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid references public.experiences(id) on delete cascade,
  visitor_key uuid not null,
  event_type text not null check (event_type in ('profile_view','experience_view')),
  visit_day date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  constraint profile_activity_target_check check (
    (event_type = 'profile_view' and experience_id is null) or
    (event_type = 'experience_view' and experience_id is not null)
  )
);
create unique index if not exists profile_activity_profile_daily_unique
  on public.profile_activity(profile_id, visitor_key, visit_day)
  where event_type = 'profile_view';
create unique index if not exists profile_activity_experience_daily_unique
  on public.profile_activity(profile_id, experience_id, visitor_key, visit_day)
  where event_type = 'experience_view';
create index if not exists profile_activity_owner_time_idx
  on public.profile_activity(profile_id, created_at desc);
alter table public.profile_activity enable row level security;
grant insert on public.profile_activity to anon, authenticated;
grant select on public.profile_activity to authenticated;
create policy "Public visitors record activity on public profiles"
on public.profile_activity for insert to anon, authenticated
with check (
  exists (select 1 from public.profiles p where p.id = profile_id and p.is_public = true)
  and (
    (event_type = 'profile_view' and experience_id is null)
    or exists (
      select 1 from public.experiences e
      where e.id = experience_id and e.owner_id = profile_id
        and e.is_public = true and e.status = 'published'
    )
  )
);
create policy "Owners read their profile activity"
on public.profile_activity for select to authenticated
using (profile_id = (select auth.uid()));
