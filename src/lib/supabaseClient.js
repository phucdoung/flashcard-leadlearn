import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL and key from environment variables
const supabaseUrl = (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '')
  ? rawUrl.trim()
  : 'https://placeholder.supabase.co';

const supabaseKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '')
  ? rawKey.trim()
  : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
