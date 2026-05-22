
-- Seed topics and subtopics for GCSE OCR Computer Science
-- Run this in the Supabase SQL Editor

-- Topics
INSERT INTO public.topics (component, title, order_number)
VALUES 
  ('01', 'Computer systems', 1),
  ('02', 'Computational thinking, algorithms and programming', 2)
ON CONFLICT DO NOTHING;

-- Subtopics for Computer systems (component 01)
WITH comp_systems AS (
  SELECT id FROM public.topics WHERE component = '01' LIMIT 1
)
INSERT INTO public.subtopics (topic_id, title, content_json, order_number)
SELECT 
  (SELECT id FROM comp_systems),
  title,
  '{}'::jsonb,
  order_number
FROM (VALUES 
  ('Systems architecture', 1),
  ('Memory and storage', 2),
  ('Computer networks', 3),
  ('Network security', 4),
  ('Systems software', 5),
  ('Ethical, legal, environmental and cultural impacts', 6)
) AS s(title, order_number)
ON CONFLICT DO NOTHING;

-- Subtopics for Computational thinking (component 02)
WITH comp_thinking AS (
  SELECT id FROM public.topics WHERE component = '02' LIMIT 1
)
INSERT INTO public.subtopics (topic_id, title, content_json, order_number)
SELECT 
  (SELECT id FROM comp_thinking),
  title,
  '{}'::jsonb,
  order_number
FROM (VALUES 
  ('Algorithms', 1),
  ('Programming fundamentals', 2),
  ('Producing robust programs', 3),
  ('Boolean logic', 4),
  ('Programming languages and IDEs', 5)
) AS s(title, order_number)
ON CONFLICT DO NOTHING;
