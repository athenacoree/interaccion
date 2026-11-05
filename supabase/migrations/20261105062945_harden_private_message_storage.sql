create policy "No direct client access to private messages"
  on private.experience_messages
  for all to anon, authenticated
  using (false)
  with check (false);

create index if not exists experience_messages_sender_created_idx
  on private.experience_messages (sender_id, created_at desc)
  where sender_id is not null;
