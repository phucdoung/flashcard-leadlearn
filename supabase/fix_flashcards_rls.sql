-- Migration Script: Fix Row Level Security (RLS) Policies for LeafLearn Flashcards & Sets
-- Solves error: "new row violates row-level security policy for table 'flashcards'"

-- 1. Enable RLS on flashcard_sets & flashcards tables
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- RLS POLICIES FOR FLASHCARD_SETS
-- ----------------------------------------------------

-- SELECT: Owner can view any set; others can view if visibility = 'public'
DROP POLICY IF EXISTS "flashcard_sets_select_policy" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Users can view their own sets or public sets" ON public.flashcard_sets;
CREATE POLICY "flashcard_sets_select_policy"
  ON public.flashcard_sets FOR SELECT
  USING (
    user_id = auth.uid() OR visibility = 'public'
  );

-- INSERT: Authenticated user can create set if user_id matches auth.uid()
DROP POLICY IF EXISTS "flashcard_sets_insert_policy" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Users can insert their own sets" ON public.flashcard_sets;
CREATE POLICY "flashcard_sets_insert_policy"
  ON public.flashcard_sets FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- UPDATE: Only owner can update set
DROP POLICY IF EXISTS "flashcard_sets_update_policy" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Users can update their own sets" ON public.flashcard_sets;
CREATE POLICY "flashcard_sets_update_policy"
  ON public.flashcard_sets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Only owner can delete set
DROP POLICY IF EXISTS "flashcard_sets_delete_policy" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Users can delete their own sets" ON public.flashcard_sets;
CREATE POLICY "flashcard_sets_delete_policy"
  ON public.flashcard_sets FOR DELETE
  USING (user_id = auth.uid());


-- ----------------------------------------------------
-- RLS POLICIES FOR FLASHCARDS
-- (Ownership is derived via flashcards.set_id -> flashcard_sets.user_id)
-- ----------------------------------------------------

-- SELECT: View flashcards if user owns parent set OR if parent set is public
DROP POLICY IF EXISTS "flashcards_select_policy" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view flashcards of own or public sets" ON public.flashcards;
CREATE POLICY "flashcards_select_policy"
  ON public.flashcards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND (flashcard_sets.user_id = auth.uid() OR flashcard_sets.visibility = 'public')
    )
  );

-- INSERT: Allow insert into flashcards ONLY IF auth.uid() is owner of parent flashcard_set
DROP POLICY IF EXISTS "flashcards_insert_policy" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert flashcards into own sets" ON public.flashcards;
CREATE POLICY "flashcards_insert_policy"
  ON public.flashcards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

-- UPDATE: Allow update flashcard ONLY IF auth.uid() is owner of parent flashcard_set
DROP POLICY IF EXISTS "flashcards_update_policy" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update flashcards of own sets" ON public.flashcards;
CREATE POLICY "flashcards_update_policy"
  ON public.flashcards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

-- DELETE: Allow delete flashcard ONLY IF auth.uid() is owner of parent flashcard_set
DROP POLICY IF EXISTS "flashcards_delete_policy" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete flashcards of own sets" ON public.flashcards;
CREATE POLICY "flashcards_delete_policy"
  ON public.flashcards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );
