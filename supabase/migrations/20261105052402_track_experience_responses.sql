alter table public.profile_activity drop constraint if exists profile_activity_event_type_check;
alter table public.profile_activity add constraint profile_activity_event_type_check
check (event_type in ('profile_view','experience_view','experience_response'));
alter table public.profile_activity drop constraint if exists profile_activity_target_check;
alter table public.profile_activity add constraint profile_activity_target_check
check (
  (event_type = 'profile_view' and experience_id is null)
  or (event_type in ('experience_view','experience_response') and experience_id is not null)
);
drop policy if exists "Public visitors record activity on public profiles" on public.profile_activity;
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
        and event_type in ('experience_view','experience_response')
    )
  )
);
