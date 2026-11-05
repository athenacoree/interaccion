-- Public media reads; authenticated uploads must be inside the uploader's UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('interaccion-media', 'interaccion-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view Interaccion media"
on storage.objects for select to anon, authenticated
using (bucket_id = 'interaccion-media');
create policy "Users upload to their own Interaccion folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'interaccion-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update files in their own Interaccion folder"
on storage.objects for update to authenticated
using (bucket_id = 'interaccion-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'interaccion-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete files in their own Interaccion folder"
on storage.objects for delete to authenticated
using (bucket_id = 'interaccion-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
