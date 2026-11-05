alter table public.experience_entries
  add column if not exists receipt_token_hash text;

create unique index if not exists experience_entries_receipt_token_hash_uidx
  on public.experience_entries (receipt_token_hash)
  where receipt_token_hash is not null;

create index if not exists experience_entries_experience_created_idx
  on public.experience_entries (experience_id, created_at desc);

create index if not exists experience_entries_respondent_created_idx
  on public.experience_entries (respondent_id, created_at desc)
  where respondent_id is not null;

create index if not exists profile_activity_profile_created_idx
  on public.profile_activity (profile_id, created_at desc);

drop policy if exists "Respondents read their own entries" on public.experience_entries;
create policy "Respondents read their own entries"
  on public.experience_entries
  for select to authenticated
  using ((select auth.uid()) = respondent_id);

create or replace function private.submit_experience_entry_with_receipt_internal(
  p_experience_id uuid,
  p_respondent_name text,
  p_is_anonymous boolean,
  p_answers jsonb,
  p_receipt_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result jsonb;
  new_entry_id uuid;
begin
  if p_receipt_token is null or pg_catalog.char_length(p_receipt_token) < 32
     or pg_catalog.char_length(p_receipt_token) > 128 then
    raise exception 'No se pudo crear el comprobante de participación.';
  end if;

  result := private.submit_experience_entry_internal(
    p_experience_id, p_respondent_name, p_is_anonymous, p_answers
  );
  new_entry_id := (result->>'entry_id')::uuid;

  update public.experience_entries
  set receipt_token_hash = pg_catalog.md5(p_receipt_token)
  where id = new_entry_id;

  return result || pg_catalog.jsonb_build_object('receipt_available', true);
end;
$function$;

create or replace function public.submit_experience_entry_with_receipt(
  p_experience_id uuid,
  p_respondent_name text,
  p_is_anonymous boolean,
  p_answers jsonb,
  p_receipt_token text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.submit_experience_entry_with_receipt_internal($1, $2, $3, $4, $5);
$function$;

create or replace function private.get_experience_entry_receipt_internal(p_receipt_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if p_receipt_token is null or pg_catalog.char_length(p_receipt_token) < 32
     or pg_catalog.char_length(p_receipt_token) > 128 then
    return null;
  end if;

  select pg_catalog.jsonb_build_object(
    'id', en.id,
    'experience_id', en.experience_id,
    'experience_title', ex.title,
    'experience_slug', ex.slug,
    'respondent_name', case when en.is_anonymous then 'Anónimo' else en.respondent_name end,
    'is_anonymous', en.is_anonymous,
    'answers', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'question_id', q.id, 'prompt', q.prompt,
        'answer', en.answers -> q.id::text, 'position', q.position
      ) order by q.position)
      from public.experience_questions q
      where q.experience_id = en.experience_id
    ), '[]'::jsonb),
    'created_at', en.created_at
  )
  into result
  from public.experience_entries en
  join public.experiences ex on ex.id = en.experience_id
  where en.receipt_token_hash = pg_catalog.md5(p_receipt_token)
  limit 1;

  return result;
end;
$function$;

create or replace function public.get_experience_entry_receipt(p_receipt_token text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.get_experience_entry_receipt_internal($1);
$function$;

revoke all on function public.submit_experience_entry_with_receipt(uuid,text,boolean,jsonb,text) from public;
grant execute on function public.submit_experience_entry_with_receipt(uuid,text,boolean,jsonb,text) to anon, authenticated;
revoke all on function public.get_experience_entry_receipt(text) from public;
grant execute on function public.get_experience_entry_receipt(text) to anon, authenticated;

grant execute on function private.submit_experience_entry_with_receipt_internal(uuid,text,boolean,jsonb,text) to anon, authenticated;
grant execute on function private.get_experience_entry_receipt_internal(text) to anon, authenticated;
