-- ========================================================
-- LeafLearn Database Migration: Folders Hierarchy & Categorization
-- Table: public.flashcard_folders
-- Foreign Key: flashcard_sets.folder_id -> flashcard_folders(id)
-- ========================================================

-- 1. Create public.flashcard_folders table
CREATE TABLE IF NOT EXISTS public.flashcard_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.flashcard_folders(id) ON DELETE CASCADE NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flashcard_folders_user_id ON public.flashcard_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_folders_parent_id ON public.flashcard_folders(parent_id);

-- 2. Enable Row Level Security (RLS) for public.flashcard_folders
ALTER TABLE public.flashcard_folders ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy for public.flashcard_folders (Users can only view/manage their own folders)
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.flashcard_folders;
DROP POLICY IF EXISTS "Users can manage their own flashcard_folders" ON public.flashcard_folders;
CREATE POLICY "Users can manage their own flashcard_folders"
  ON public.flashcard_folders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Add folder_id to public.flashcard_sets (referencing flashcard_folders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'flashcard_sets' 
      AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE public.flashcard_sets 
    ADD COLUMN folder_id UUID REFERENCES public.flashcard_folders(id) ON DELETE SET NULL NULL;
  END IF;
END $$;

-- Index for folder_id in flashcard_sets
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_folder_id ON public.flashcard_sets(folder_id);
