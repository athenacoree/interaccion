alter table public.experiences drop constraint if exists experiences_status_check;
alter table public.experiences add constraint experiences_status_check
check (status in ('draft','published','paused','archived'));
