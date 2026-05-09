alter table public.groups drop constraint if exists groups_status_check;
alter table public.groups add constraint groups_status_check check (status in ('active', 'completed', 'cancelled'));
