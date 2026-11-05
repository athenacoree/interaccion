drop table if exists public.experience_events;
drop table if exists public.profile_visits;
drop index if exists public.profile_activity_response_daily_unique;
create index if not exists profile_activity_experience_id_idx on public.profile_activity(experience_id);
