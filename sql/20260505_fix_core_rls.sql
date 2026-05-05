-- ============================================
-- QuizDog core table RLS fix
-- ============================================
-- Run this on a DB where the app fails with:
-- "new row violates row-level security policy for table \"rooms\""
--
-- The current app uses the Supabase anon client for classroom flows, so these
-- core runtime tables must be writable by anon/authenticated roles.

BEGIN;

ALTER TABLE public.question_sets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.questions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rooms NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.players NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_sets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players TO anon, authenticated;

COMMIT;
