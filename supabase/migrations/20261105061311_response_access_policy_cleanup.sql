drop policy if exists "Owners read entries for their experiences" on public.experience_entries;
drop policy if exists "Respondents read their own entries" on public.experience_entries;
create policy "Owners and respondents read permitted entries"
  on public.experience_entries
  for select to authenticated
  using (
    (select auth.uid()) = respondent_id
    or exists (
      select 1 from public.experiences e
      where e.id = experience_entries.experience_id
        and e.owner_id = (select auth.uid())
    )
  );

drop index if exists public.profile_activity_profile_created_idx;
