-- Function to find a profile by the first 8 hex chars of their UUID
-- Used by Bluetooth proximity to resolve shortId → full profile
CREATE OR REPLACE FUNCTION public.find_profile_by_id_prefix(p_prefix text)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM profiles p
  WHERE p.id::text LIKE p_prefix || '%'
  LIMIT 1;
$$;

-- Allow authenticated users to call this
GRANT EXECUTE ON FUNCTION public.find_profile_by_id_prefix(text) TO authenticated;
