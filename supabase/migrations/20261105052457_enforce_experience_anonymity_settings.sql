drop policy if exists "Visitors submit to public experiences" on public.experience_entries;
create policy "Visitors submit to public experiences"
on public.experience_entries for insert to anon, authenticated
with check (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id
      and e.is_public = true
      and e.status = 'published'
      and (not is_anonymous or coalesce(e.settings->>'allow_anonymous','true') <> 'false')
      and (is_anonymous or nullif(btrim(respondent_name),'') is not null)
  )
);
