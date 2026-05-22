-- FIX: Use auth.jwt() instead of subqueries to avoid circular RLS dependency

-- Remove any broken policies from previous attempts
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Teachers can read all question sets" ON question_sets;
DROP POLICY IF EXISTS "Teachers can read all student answers" ON student_answers;
DROP POLICY IF EXISTS "Teachers insert own question sets" ON question_sets;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Teachers manage question sets" ON question_sets;
DROP POLICY IF EXISTS "Students view question sets" ON question_sets;
DROP POLICY IF EXISTS "Teachers view student answers" ON student_answers;
DROP POLICY IF EXISTS "Students manage own answers" ON student_answers;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE released_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

-- Profiles: users read own + teachers read all (via JWT)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers read all profiles" ON profiles
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Topics/public: publicly readable
DROP POLICY IF EXISTS "Topics publicly readable" ON topics;
CREATE POLICY "Topics publicly readable" ON topics
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Subtopics publicly readable" ON subtopics;
CREATE POLICY "Subtopics publicly readable" ON subtopics
  FOR SELECT USING (true);

-- Released subtopics: teachers can manage, students read
DROP POLICY IF EXISTS "Teachers manage released subtopics" ON released_subtopics;
CREATE POLICY "Teachers manage released subtopics" ON released_subtopics
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');
DROP POLICY IF EXISTS "Students view released subtopics" ON released_subtopics;
CREATE POLICY "Students view released subtopics" ON released_subtopics
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'student');

-- Question sets: teachers manage, students read
DROP POLICY IF EXISTS "Teachers manage question sets" ON question_sets;
CREATE POLICY "Teachers manage question sets" ON question_sets
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');
DROP POLICY IF EXISTS "Students view question sets" ON question_sets;
CREATE POLICY "Students view question sets" ON question_sets
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'student');

-- Student answers: own only, teachers can read
DROP POLICY IF EXISTS "Students manage own answers" ON student_answers;
CREATE POLICY "Students manage own answers" ON student_answers
  FOR ALL USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Teachers view student answers" ON student_answers;
CREATE POLICY "Teachers view student answers" ON student_answers
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher');

-- Allow seed inserts
DROP POLICY IF EXISTS "Allow seed inserts on topics" ON topics;
CREATE POLICY "Allow seed inserts on topics" ON topics
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow seed inserts on subtopics" ON subtopics;
CREATE POLICY "Allow seed inserts on subtopics" ON subtopics
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow seed updates on subtopics" ON subtopics;
CREATE POLICY "Allow seed updates on subtopics" ON subtopics
  FOR UPDATE USING (true) WITH CHECK (true);
