-- Run in Supabase Dashboard SQL Editor
ALTER TABLE dp_blasts ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE dp_blasts ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT '';
ALTER TABLE dp_blasts ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT false;
