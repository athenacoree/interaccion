create policy "Owners can delete entries for their experiences"
on public.experience_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_entries.experience_id
      and e.owner_id = (select auth.uid())
  )
);
