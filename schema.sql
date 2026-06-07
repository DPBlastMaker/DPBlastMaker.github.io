-- Run this in your Supabase SQL Editor
-- Safe to re-run multiple times - all statements handle existing objects

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DP Blasts table
CREATE TABLE IF NOT EXISTS dp_blasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  frame_url TEXT NOT NULL,
  owner UUID REFERENCES profiles(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add likes column if missing (safe for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dp_blasts' AND column_name = 'likes') THEN
    ALTER TABLE dp_blasts ADD COLUMN likes INTEGER DEFAULT 0;
  END IF;
END $$;

-- 3. Storage bucket for frames
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'frames') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('frames', 'frames', true);
  END IF;
END $$;

-- 4. Auto-create profile on signup (trigger, safe to re-run)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(SPLIT_PART(NEW.email, '@', 1), 'user'),
    'creator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_blasts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are publicly readable" ON profiles;
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- DP Blasts policies
DROP POLICY IF EXISTS "Blasts are publicly readable" ON dp_blasts;
CREATE POLICY "Blasts are publicly readable"
  ON dp_blasts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create blasts" ON dp_blasts;
CREATE POLICY "Authenticated users can create blasts"
  ON dp_blasts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can update own blasts" ON dp_blasts;
CREATE POLICY "Creators can update own blasts"
  ON dp_blasts FOR UPDATE
  USING (auth.uid() = owner);

DROP POLICY IF EXISTS "Creators can delete own blasts" ON dp_blasts;
CREATE POLICY "Creators can delete own blasts"
  ON dp_blasts FOR DELETE
  USING (auth.uid() = owner);

DROP POLICY IF EXISTS "Admins can delete any blast" ON dp_blasts;
CREATE POLICY "Admins can delete any blast"
  ON dp_blasts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Storage RLS
DROP POLICY IF EXISTS "Anyone can read frames" ON storage.objects;
CREATE POLICY "Anyone can read frames"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'frames');

DROP POLICY IF EXISTS "Authenticated users can upload frames" ON storage.objects;
CREATE POLICY "Authenticated users can upload frames"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'frames'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Owners can delete their frames" ON storage.objects;
CREATE POLICY "Owners can delete their frames"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'frames'
    AND auth.uid() = owner
  );

-- 7. Increment likes RPC function
CREATE OR REPLACE FUNCTION increment_likes(p_blast_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE dp_blasts SET likes = COALESCE(likes, 0) + 1 WHERE id = p_blast_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_likes TO anon, authenticated;

-- 9. Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action, created_at);

-- 10. Admin functions (SECURITY DEFINER—no service key in client)
-- Bootstrap first admin (only works if zero admins exist)
CREATE OR REPLACE FUNCTION bootstrap_first_admin()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;
  UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

-- Admin: create a new user (auth + profile)
CREATE OR REPLACE FUNCTION admin_create_user(
  p_username TEXT, p_password TEXT, p_role TEXT DEFAULT 'creator'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
  encrypted_pw TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  new_id := gen_random_uuid();
  SELECT crypt(p_password, gen_salt('bf')) INTO encrypted_pw;
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  VALUES (new_id, p_username || '@dpblast.local', encrypted_pw, NOW(),
    jsonb_build_object('username', p_username));
  INSERT INTO profiles (id, username, role) VALUES (new_id, p_username, p_role);
  RETURN new_id;
END;
$$;

-- Admin: list all users with profile + blast count
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(id UUID, email TEXT, username TEXT, role TEXT, created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ, blast_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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

-- Admin: delete a user entirely (cascades)
CREATE OR REPLACE FUNCTION admin_delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- Admin: reset user password
CREATE OR REPLACE FUNCTION admin_reset_password(target_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  encrypted_pw TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  SELECT crypt(new_password, gen_salt('bf')) INTO encrypted_pw;
  UPDATE auth.users SET encrypted_password = encrypted_pw, updated_at = NOW()
  WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION bootstrap_first_admin TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_users TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password TO authenticated;

-- 11. Enable UUID extension (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
