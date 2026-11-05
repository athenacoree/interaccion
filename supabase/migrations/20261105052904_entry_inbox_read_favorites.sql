alter table public.experience_entries
  add column if not exists read_at timestamptz,
  add column if not exists is_favorite boolean not null default false;
grant update (read_at, is_favorite) on public.experience_entries to authenticated;
drop policy if exists "Owners update entry inbox metadata" on public.experience_entries;
create policy "Owners update entry inbox metadata"
on public.experience_entries for update to authenticated
using (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id and e.owner_id = (select auth.uid())
  )
);
