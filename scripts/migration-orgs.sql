-- Run this in the Supabase SQL Editor
-- Creates organizations table and adds organization_id to profiles

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create default org and assign all existing users to it
INSERT INTO organizations (name, slug) VALUES ('Test Organisation', 'test-organisation')
ON CONFLICT (slug) DO NOTHING;

-- Assign all existing profiles to the test org
UPDATE profiles SET organization_id = (SELECT id FROM organizations WHERE slug = 'test-organisation')
WHERE organization_id IS NULL;

-- RLS policies for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Everyone can read organizations
CREATE POLICY "Anyone can read organizations"
  ON organizations FOR SELECT
  USING (true);

-- Only authenticated users can insert organizations
CREATE POLICY "Authenticated users can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Update profiles RLS to allow organization_id access
-- Teachers can read profiles in their org
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;
CREATE POLICY "Teachers can read profiles in their org"
  ON profiles FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Students can read profiles in their org (for display)
DROP POLICY IF EXISTS "Students can read own profile" ON profiles;
CREATE POLICY "Students can read profiles in their org"
  ON profiles FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND (
      id = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
