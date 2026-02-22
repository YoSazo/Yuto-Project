-- plan-images bucket for plan photos
-- Creates bucket and RLS policies. If bucket already exists (e.g. from Dashboard), the insert will conflict; that's ok.

insert into storage.buckets (id, name, public)
values ('plan-images', 'plan-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder (creatorId in path)
drop policy if exists "Authenticated users can upload plan images" on storage.objects;
create policy "Authenticated users can upload plan images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'plan-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read (bucket is public, but explicit SELECT policy for consistency)
drop policy if exists "Public can view plan images" on storage.objects;
create policy "Public can view plan images"
on storage.objects for select
to public
using (bucket_id = 'plan-images');
