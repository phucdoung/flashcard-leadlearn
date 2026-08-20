-- ====================================================================
-- FIX RLS POLICIES FOR PUBLIC FLASHCARDS AND FLASHCARD SETS
-- ====================================================================

-- 1. Ensure RLS is enabled on both tables
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. POLICIES FOR public.flashcard_sets
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own or public flashcard sets" ON public.flashcard_sets;
CREATE POLICY "Users can view own or public flashcard sets"
  ON public.flashcard_sets FOR SELECT
  USING (auth.uid() = user_id OR visibility = 'public');

DROP POLICY IF EXISTS "Users can insert own flashcard sets" ON public.flashcard_sets;
CREATE POLICY "Users can insert own flashcard sets"
  ON public.flashcard_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flashcard sets" ON public.flashcard_sets;
CREATE POLICY "Users can update own flashcard sets"
  ON public.flashcard_sets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own flashcard sets" ON public.flashcard_sets;
CREATE POLICY "Users can delete own flashcard sets"
  ON public.flashcard_sets FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 3. POLICIES FOR public.flashcards
-- --------------------------------------------------------------------

-- SELECT: Allow viewing flashcards if set belongs to user OR parent set is PUBLIC
DROP POLICY IF EXISTS "Users can view flashcards of own or public sets" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view flashcards of own sets" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;

CREATE POLICY "Users can view flashcards of own or public sets"
  ON public.flashcards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      WHERE fs.id = flashcards.set_id
        AND (fs.user_id = auth.uid() OR fs.visibility = 'public')
    )
  );

-- INSERT: Allow inserting flashcards ONLY into sets owned by user
DROP POLICY IF EXISTS "Users can insert flashcards into own sets" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;

CREATE POLICY "Users can insert flashcards into own sets"
  ON public.flashcards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      WHERE fs.id = flashcards.set_id
        AND fs.user_id = auth.uid()
    )
  );

-- UPDATE: Allow updating flashcards ONLY in sets owned by user
DROP POLICY IF EXISTS "Users can update flashcards in own sets" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;

CREATE POLICY "Users can update flashcards in own sets"
  ON public.flashcards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      WHERE fs.id = flashcards.set_id
        AND fs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      WHERE fs.id = flashcards.set_id
        AND fs.user_id = auth.uid()
    )
  );

-- DELETE: Allow deleting flashcards ONLY from sets owned by user
DROP POLICY IF EXISTS "Users can delete flashcards from own sets" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete own flashcards" ON public.flashcards;

CREATE POLICY "Users can delete flashcards from own sets"
  ON public.flashcards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      WHERE fs.id = flashcards.set_id
        AND fs.user_id = auth.uid()
    )
  );
