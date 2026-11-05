create or replace function private.get_experience_leaderboard_internal(p_experience_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  exp public.experiences%rowtype;
  result jsonb;
begin
  select * into exp
  from public.experiences e
  where e.id = p_experience_id
    and e.is_public = true
    and e.status = 'published'
    and e.kind = 'know_me';

  if not found then
    raise exception 'Esta clasificación no está disponible.';
  end if;

  with scored as (
    select
      en.id,
      coalesce(nullif(pg_catalog.btrim(pr.display_name), ''), nullif(pg_catalog.btrim(en.respondent_name), ''), 'Participante') as display_name,
      pr.avatar_url,
      count(q.id)::integer as total,
      count(q.id) filter (
        where en.answers ->> q.id::text = q.options -> k.correct_option_index ->> 'label'
      )::integer as correct,
      en.created_at
    from public.experience_entries en
    join public.experience_questions q on q.experience_id = en.experience_id
    join public.experience_answer_keys k on k.question_id = q.id
    left join public.profiles pr on pr.id = en.respondent_id
    where en.experience_id = p_experience_id
      and en.is_anonymous = false
    group by en.id, en.respondent_name, pr.display_name, pr.avatar_url, en.created_at
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'position', ranked.position,
        'display_name', ranked.display_name,
        'avatar_url', ranked.avatar_url,
        'correct', ranked.correct,
        'total', ranked.total,
        'percentage', case when ranked.total > 0 then round(ranked.correct * 100.0 / ranked.total)::integer else 0 end
      )
      order by ranked.correct desc, ranked.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      row_number() over (order by correct desc, created_at asc)::integer as position,
      display_name, avatar_url, correct, total, created_at
    from scored
    where total > 0
    order by correct desc, created_at asc
    limit 100
  ) ranked;

  return result;
end;
$$;

create or replace function public.get_experience_leaderboard(p_experience_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_experience_leaderboard_internal($1);
$$;

grant usage on schema private to anon, authenticated;
grant execute on function private.get_experience_leaderboard_internal(uuid) to anon, authenticated;
grant execute on function public.get_experience_leaderboard(uuid) to anon, authenticated;
