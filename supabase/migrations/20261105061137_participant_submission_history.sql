create or replace function private.get_my_experience_entries_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result jsonb;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(entry_row.payload order by entry_row.created_at desc),
    '[]'::jsonb
  )
  into result
  from (
    select
      en.created_at,
      pg_catalog.jsonb_build_object(
        'id', en.id,
        'experience_id', en.experience_id,
        'experience_title', ex.title,
        'experience_slug', ex.slug,
        'experience_kind', ex.kind,
        'respondent_name', case when en.is_anonymous then 'Anónimo' else en.respondent_name end,
        'is_anonymous', en.is_anonymous,
        'created_at', en.created_at,
        'answers', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'question_id', q.id, 'prompt', q.prompt,
            'answer', en.answers -> q.id::text, 'position', q.position
          ) order by q.position)
          from public.experience_questions q
          where q.experience_id = en.experience_id
        ), '[]'::jsonb)
      ) as payload
    from public.experience_entries en
    join public.experiences ex on ex.id = en.experience_id
    where en.respondent_id = current_user_id
    order by en.created_at desc
    limit 50
  ) entry_row;

  return result;
end;
$function$;

create or replace function public.get_my_experience_entries()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.get_my_experience_entries_internal();
$function$;

revoke all on function public.get_my_experience_entries() from public;
grant execute on function public.get_my_experience_entries() to authenticated;
grant execute on function private.get_my_experience_entries_internal() to authenticated;
