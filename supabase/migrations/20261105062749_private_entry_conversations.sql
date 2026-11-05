create table if not exists private.experience_messages (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.experience_entries(id) on delete cascade,
  sender_id uuid null references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('owner','respondent')),
  sender_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists experience_messages_entry_created_idx on private.experience_messages (entry_id, created_at asc);
alter table private.experience_messages enable row level security;
revoke all on private.experience_messages from anon, authenticated, public;

create or replace function private.get_entry_conversation_internal(p_entry_id uuid,p_receipt_token text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  entry_row public.experience_entries%rowtype;
  owner_id uuid;
  result jsonb;
begin
  select en.* into entry_row from public.experience_entries en where en.id = p_entry_id;
  if not found then return null; end if;
  select ex.owner_id into owner_id from public.experiences ex where ex.id = entry_row.experience_id;
  if auth.uid() is distinct from owner_id
     and auth.uid() is distinct from entry_row.respondent_id
     and not (p_receipt_token is not null and entry_row.receipt_token_hash = pg_catalog.md5(p_receipt_token)) then
    raise exception 'No tienes permiso para abrir esta conversación.';
  end if;
  select pg_catalog.jsonb_build_object(
    'entry_id',entry_row.id,
    'experience_id',entry_row.experience_id,
    'participant_name',case when entry_row.is_anonymous then 'Participante anónimo' else coalesce(entry_row.respondent_name,'Participante') end,
    'messages',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',m.id,'sender_role',m.sender_role,'sender_name',m.sender_name,'body',m.body,'created_at',m.created_at) order by m.created_at asc)
      from private.experience_messages m where m.entry_id=entry_row.id
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

create or replace function private.send_entry_message_internal(p_entry_id uuid,p_body text,p_receipt_token text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  entry_row public.experience_entries%rowtype;
  owner_id uuid;
  owner_name text;
  sender_role text;
  sender_name text;
  new_message private.experience_messages%rowtype;
begin
  if p_body is null or pg_catalog.char_length(pg_catalog.btrim(p_body)) < 1 or pg_catalog.char_length(p_body) > 2000 then
    raise exception 'El mensaje debe tener entre 1 y 2000 caracteres.';
  end if;
  select en.* into entry_row from public.experience_entries en where en.id=p_entry_id;
  if not found then raise exception 'Esta conversación ya no está disponible.'; end if;
  select ex.owner_id into owner_id from public.experiences ex where ex.id=entry_row.experience_id;

  if auth.uid() = owner_id then
    sender_role := 'owner';
    select p.display_name into owner_name from public.profiles p where p.id=owner_id;
    sender_name := coalesce(owner_name,'Creador');
  elsif auth.uid() is not null and auth.uid() = entry_row.respondent_id then
    sender_role := 'respondent';
    sender_name := case when entry_row.is_anonymous then 'Participante' else coalesce(entry_row.respondent_name,'Participante') end;
  elsif p_receipt_token is not null and entry_row.receipt_token_hash=pg_catalog.md5(p_receipt_token) then
    sender_role := 'respondent';
    sender_name := case when entry_row.is_anonymous then 'Participante anónimo' else coalesce(entry_row.respondent_name,'Participante') end;
  else
    raise exception 'No tienes permiso para responder en esta conversación.';
  end if;

  insert into private.experience_messages(entry_id,sender_id,sender_role,sender_name,body)
  values (p_entry_id,auth.uid(),sender_role,sender_name,pg_catalog.btrim(p_body))
  returning * into new_message;
  return pg_catalog.jsonb_build_object('id',new_message.id,'sender_role',new_message.sender_role,'sender_name',new_message.sender_name,'body',new_message.body,'created_at',new_message.created_at);
end;
$function$;

create or replace function public.get_entry_conversation(p_entry_id uuid,p_receipt_token text default null)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.get_entry_conversation_internal($1,$2); $function$;
create or replace function public.send_entry_message(p_entry_id uuid,p_body text,p_receipt_token text default null)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.send_entry_message_internal($1,$2,$3); $function$;

revoke all on function public.get_entry_conversation(uuid,text) from public;
revoke all on function public.send_entry_message(uuid,text,text) from public;
grant execute on function public.get_entry_conversation(uuid,text) to anon, authenticated;
grant execute on function public.send_entry_message(uuid,text,text) to anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.get_entry_conversation_internal(uuid,text) to anon, authenticated;
grant execute on function private.send_entry_message_internal(uuid,text,text) to anon, authenticated;
