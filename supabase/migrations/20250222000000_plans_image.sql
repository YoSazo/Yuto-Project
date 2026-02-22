-- Add image_url to plans
-- Create bucket in Supabase Dashboard: Storage → New bucket → "plan-images" (public)

alter table plans add column if not exists image_url text;
