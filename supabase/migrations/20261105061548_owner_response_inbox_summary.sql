create or replace function private.get_owner_inbox_summary_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', summary.id,
        'title', summary.title,
        'slug', summary.slug,
        'kind', summary.kind,
        'total', summary.total,
        'unread', summary.unread,
        'last_response', summary.last_response
      ) order by summary.last_response desc nulls last, summary.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      ex.id, ex.title, ex.slug, ex.kind, ex.created_at,
      count(en.id)::integer as total,
      count(en.id) filter (where en.read_at is null)::integer as unread,
      max(en.created_at) as last_response
    from public.experiences ex
    left join public.experience_entries en on en.experience_id = ex.id
    where ex.owner_id = current_user_id
    group by ex.id
  ) summary;

  return result;
end;
$function$;

create or replace function public.get_owner_inbox_summary()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.get_owner_inbox_summary_internal();
$function$;

revoke all on function public.get_owner_inbox_summary() from public;
grant execute on function public.get_owner_inbox_summary() to authenticated;
grant execute on function private.get_owner_inbox_summary_internal() to authenticated;
