-- Run this in Supabase Dashboard → SQL Editor
-- Adds admin RPC functions + rate_limits table

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action, created_at);

CREATE OR REPLACE FUNCTION bootstrap_first_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;
  UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_user(p_username TEXT, p_password TEXT, p_role TEXT DEFAULT 'creator')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id UUID; encrypted_pw TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  new_id := gen_random_uuid();
  SELECT crypt(p_password, gen_salt('bf')) INTO encrypted_pw;
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  VALUES (new_id, p_username || '@dpblast.local', encrypted_pw, NOW(), jsonb_build_object('username', p_username));
  INSERT INTO profiles (id, username, role) VALUES (new_id, p_username, p_role);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(id UUID, email TEXT, username TEXT, role TEXT, created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ, blast_count BIGINT)
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

CREATE OR REPLACE FUNCTION admin_delete_user(target_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Cannot delete yourself'; END IF;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_reset_password(target_id UUID, new_password TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE encrypted_pw TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  SELECT crypt(new_password, gen_salt('bf')) INTO encrypted_pw;
  UPDATE auth.users SET encrypted_password = encrypted_pw, updated_at = NOW() WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION bootstrap_first_admin TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_users TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password TO authenticated;
