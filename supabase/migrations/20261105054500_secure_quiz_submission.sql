-- Keep quiz answer keys private and validate submissions in the database.
create table if not exists public.experience_answer_keys (
  question_id uuid primary key references public.experience_questions(id) on delete cascade,
  correct_option_index integer not null check (correct_option_index >= 0),
  created_at timestamptz not null default now()
);
alter table public.experience_answer_keys enable row level security;
grant select, insert, update, delete on public.experience_answer_keys to authenticated;
create policy "Owners manage private experience answer keys"
on public.experience_answer_keys for all to authenticated
using (
  exists (
    select 1 from public.experience_questions q
    join public.experiences e on e.id = q.experience_id
    where q.id = question_id and e.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.experience_questions q
    join public.experiences e on e.id = q.experience_id
    where q.id = question_id and e.owner_id = (select auth.uid())
  )
);
insert into public.experience_answer_keys(question_id, correct_option_index)
select q.id, greatest(0, (q.media->>'correct_option_index')::integer)
from public.experience_questions q
where jsonb_typeof(q.media) = 'object' and q.media ? 'correct_option_index'
on conflict (question_id) do update set correct_option_index = excluded.correct_option_index;
update public.experience_questions
set media = '[]'::jsonb
where jsonb_typeof(media) = 'object' and media ? 'correct_option_index';
revoke insert on public.experience_entries from anon, authenticated;
grant delete on public.experience_entries to authenticated;

create or replace function public.submit_experience_entry(
  p_experience_id uuid,
  p_respondent_name text,
  p_is_anonymous boolean,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.experiences%rowtype;
  question_row record;
  question_total integer;
  correct_total integer := 0;
  new_entry_id uuid;
  selected_answer text;
begin
  select * into exp
  from public.experiences
  where id = p_experience_id and is_public = true and status = 'published';
  if not found then raise exception 'Esta experiencia ya no está disponible.'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Las respuestas no tienen un formato válido.';
  end if;
  if coalesce((exp.settings->>'allow_anonymous')::boolean, true) = false and p_is_anonymous then
    raise exception 'Esta experiencia no permite respuestas anónimas.';
  end if;
  if not p_is_anonymous and nullif(trim(p_respondent_name), '') is null then
    raise exception 'Escribe el nombre que quieres mostrar.';
  end if;
  select count(*) into question_total
  from public.experience_questions where experience_id = p_experience_id;
  if question_total = 0 then raise exception 'Esta experiencia todavía no tiene preguntas.'; end if;

  for question_row in
    select id, answer_type, options from public.experience_questions
    where experience_id = p_experience_id order by position
  loop
    if not (p_answers ? question_row.id::text) then
      raise exception 'Responde todas las preguntas antes de enviar.';
    end if;
    selected_answer := p_answers->>question_row.id::text;
    if question_row.answer_type = 'text' then
      if nullif(trim(selected_answer), '') is null or char_length(selected_answer) > 1000 then
        raise exception 'Revisa el texto de tus respuestas.';
      end if;
    elsif not exists (
      select 1 from jsonb_array_elements(question_row.options) option_row
      where option_row->>'label' = selected_answer
    ) then
      raise exception 'Una de las opciones ya no es válida. Recarga el juego.';
    end if;
  end loop;

  insert into public.experience_entries(
    experience_id, respondent_id, respondent_name, is_anonymous, answers
  ) values (
    p_experience_id, auth.uid(),
    case when p_is_anonymous then null else left(trim(p_respondent_name), 60) end,
    p_is_anonymous, p_answers
  ) returning id into new_entry_id;

  if exp.kind = 'know_me' then
    select count(*) into correct_total
    from public.experience_questions q
    join public.experience_answer_keys k on k.question_id = q.id
    where q.experience_id = p_experience_id
      and p_answers->>q.id::text = q.options->k.correct_option_index->>'label';
  end if;

  return jsonb_build_object(
    'entry_id', new_entry_id,
    'correct', case when exp.kind = 'know_me' then correct_total else null end,
    'total', question_total
  );
end;
$$;
revoke all on function public.submit_experience_entry(uuid,text,boolean,jsonb) from public;
grant execute on function public.submit_experience_entry(uuid,text,boolean,jsonb) to anon, authenticated;
