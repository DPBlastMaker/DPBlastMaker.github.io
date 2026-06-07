-- Run in Supabase Dashboard → SQL Editor
-- Drop first, then recreate with fixed column names

DROP FUNCTION IF EXISTS admin_get_users() CASCADE;

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(uid UUID, user_email TEXT, user_username TEXT, user_role TEXT, user_created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ, blast_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can list users';
  END IF;
  RETURN QUERY
  SELECT au.id, au.email::TEXT, p.username, p.role, p.created_at, au.last_sign_in_at,
    (SELECT COUNT(*) FROM dp_blasts WHERE owner = au.id)::BIGINT
  FROM auth.users au JOIN profiles p ON p.id = au.id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_users TO authenticated;
