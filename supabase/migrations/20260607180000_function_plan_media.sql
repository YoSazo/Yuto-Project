-- Multi-media for functions and plans (up to 5 assets on client)

create table if not exists public.function_media (
  id uuid primary key default gen_random_uuid(),
  function_id uuid references public.functions(id) on delete cascade not null,
  media_url text not null,
  media_type text not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists function_media_function_sort on public.function_media(function_id, sort_index);

alter table public.function_media enable row level security;

create policy "Function media is readable"
on public.function_media for select
using (
  exists (
    select 1 from public.functions f
    where f.id = function_media.function_id
      and (
        f.is_public = true
        or f.host_id = auth.uid()
      )
  )
);

create policy "Hosts can insert function media"
on public.function_media for insert
with check (
  exists (
    select 1 from public.functions f
    where f.id = function_media.function_id
      and f.host_id = auth.uid()
  )
);

create policy "Hosts can delete function media"
on public.function_media for delete
using (
  exists (
    select 1 from public.functions f
    where f.id = function_media.function_id
      and f.host_id = auth.uid()
  )
);

create table if not exists public.plan_media (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  media_url text not null,
  media_type text not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_media_plan_sort on public.plan_media(plan_id, sort_index);

alter table public.plan_media enable row level security;

create policy "Plan media is readable"
on public.plan_media for select
using (true);

create policy "Creators can insert plan media"
on public.plan_media for insert
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_media.plan_id
      and p.creator_id = auth.uid()
  )
);

create policy "Creators can delete plan media"
on public.plan_media for delete
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_media.plan_id
      and p.creator_id = auth.uid()
  )
);

