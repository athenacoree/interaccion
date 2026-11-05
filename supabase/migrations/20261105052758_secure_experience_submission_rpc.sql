create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.submit_experience_entry_internal(
  p_experience_id uuid,
  p_respondent_name text,
  p_is_anonymous boolean,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  exp public.experiences%rowtype;
  question_row record;
  question_total integer;
  answer_total integer;
  key_total integer := 0;
  correct_total integer := 0;
  new_entry_id uuid;
  selected_answer text;
begin
  select * into exp
  from public.experiences e
  where e.id = p_experience_id and e.is_public = true and e.status = 'published';
  if not found then raise exception 'Esta experiencia ya no está disponible.'; end if;

  if pg_catalog.jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Las respuestas no tienen un formato válido.';
  end if;
  if coalesce((exp.settings->>'allow_anonymous')::boolean, true) = false and p_is_anonymous then
    raise exception 'Esta experiencia no permite respuestas anónimas.';
  end if;
  if not p_is_anonymous and nullif(pg_catalog.btrim(p_respondent_name), '') is null then
    raise exception 'Escribe el nombre que quieres mostrar.';
  end if;
  if not p_is_anonymous and pg_catalog.char_length(pg_catalog.btrim(p_respondent_name)) > 60 then
    raise exception 'El nombre no puede superar 60 caracteres.';
  end if;

  select pg_catalog.count(*) into question_total
  from public.experience_questions q
  where q.experience_id = p_experience_id;
  if question_total = 0 then raise exception 'Esta experiencia todavía no tiene preguntas.'; end if;

  select pg_catalog.count(*) into answer_total
  from pg_catalog.jsonb_object_keys(p_answers);
  if answer_total <> question_total then
    raise exception 'El número de respuestas no coincide con las preguntas.';
  end if;

  for question_row in
    select q.id, q.answer_type, q.options
    from public.experience_questions q
    where q.experience_id = p_experience_id
    order by q.position
  loop
    if not (p_answers ? question_row.id::text) then
      raise exception 'Responde todas las preguntas antes de enviar.';
    end if;
    selected_answer := p_answers->>(question_row.id::text);
    if question_row.answer_type = 'text' then
      if pg_catalog.jsonb_typeof(p_answers->(question_row.id::text)) is distinct from 'string'
        or nullif(pg_catalog.btrim(selected_answer), '') is null
        or pg_catalog.char_length(selected_answer) > 1000 then
        raise exception 'Revisa el texto de tus respuestas.';
      end if;
    else
      if pg_catalog.jsonb_typeof(p_answers->(question_row.id::text)) is distinct from 'string'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(question_row.options) as option_row(value)
          where option_row.value->>'label' = selected_answer
        ) then
        raise exception 'Una de las opciones ya no es válida. Recarga el juego.';
      end if;
    end if;
  end loop;

  insert into public.experience_entries(
    experience_id, respondent_id, respondent_name, is_anonymous, answers
  ) values (
    p_experience_id, auth.uid(),
    case when p_is_anonymous then null else pg_catalog.left(pg_catalog.btrim(p_respondent_name), 60) end,
    p_is_anonymous, p_answers
  ) returning id into new_entry_id;

  if exp.kind = 'know_me' then
    select pg_catalog.count(*) into key_total
    from public.experience_questions q
    join public.experience_answer_keys k on k.question_id = q.id
    where q.experience_id = p_experience_id;

    if key_total = question_total then
      select pg_catalog.count(*) into correct_total
      from public.experience_questions q
      join public.experience_answer_keys k on k.question_id = q.id
      where q.experience_id = p_experience_id
        and p_answers->>(q.id::text) = q.options->k.correct_option_index->>'label';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'entry_id', new_entry_id,
    'correct', case when exp.kind = 'know_me' and key_total = question_total then correct_total else null end,
    'total', question_total
  );
end;
$function$;

revoke all on function private.submit_experience_entry_internal(uuid,text,boolean,jsonb) from public;
grant execute on function private.submit_experience_entry_internal(uuid,text,boolean,jsonb) to anon, authenticated;

create or replace function public.submit_experience_entry(
  p_experience_id uuid,
  p_respondent_name text,
  p_is_anonymous boolean,
  p_answers jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.submit_experience_entry_internal($1,$2,$3,$4);
$function$;

revoke all on function public.submit_experience_entry(uuid,text,boolean,jsonb) from public;
grant execute on function public.submit_experience_entry(uuid,text,boolean,jsonb) to anon, authenticated;

revoke all on table public.experience_answer_keys from anon;
grant select, insert, update, delete on table public.experience_answer_keys to authenticated;

revoke all on table public.experience_entries from anon, authenticated;
grant select, delete on table public.experience_entries to authenticated;
drop policy if exists "Visitors submit to public experiences" on public.experience_entries;
