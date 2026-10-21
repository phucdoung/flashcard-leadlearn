-- ========================================================
-- LeafLearn Database Migration: Folders Hierarchy & Categorization
-- ========================================================

-- 1. Create public.folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);

-- 2. Enable Row Level Security (RLS) for public.folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy for public.folders (Users can only view/manage their own folders)
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.folders;
CREATE POLICY "Users can manage their own folders"
  ON public.folders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Add folder_id to public.flashcard_sets (preserving existing records with folder_id NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'flashcard_sets' 
      AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE public.flashcard_sets 
    ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL NULL;
  END IF;
END $$;

-- Index for folder_id in flashcard_sets
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_folder_id ON public.flashcard_sets(folder_id);
