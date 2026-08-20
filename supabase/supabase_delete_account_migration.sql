-- Migration Script for Supabase SQL Editor
-- Sets up ON DELETE CASCADE for foreign key constraints on LeafLearn tables

-- 1. flashcard_sets -> auth.users
ALTER TABLE public.flashcard_sets
  DROP CONSTRAINT IF EXISTS flashcard_sets_user_id_fkey,
  ADD CONSTRAINT flashcard_sets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. flashcards -> flashcard_sets
ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_set_id_fkey,
  ADD CONSTRAINT flashcards_set_id_fkey
  FOREIGN KEY (set_id) REFERENCES public.flashcard_sets(id) ON DELETE CASCADE;

-- 3. quizzes -> auth.users
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey,
  ADD CONSTRAINT quizzes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. quiz_results -> auth.users
ALTER TABLE public.quiz_results
  DROP CONSTRAINT IF EXISTS quiz_results_user_id_fkey,
  ADD CONSTRAINT quiz_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
