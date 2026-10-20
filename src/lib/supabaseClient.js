import { createClient } from '@supabase/supabase-js';

// Safe environment variable retrieval across Next.js and Vite
const getEnvVar = (nextKey, viteKey) => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[nextKey]) return process.env[nextKey];
    if (process.env[viteKey]) return process.env[viteKey];
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env[nextKey]) return import.meta.env[nextKey];
      if (import.meta.env[viteKey]) return import.meta.env[viteKey];
    }
  } catch (_e) {
    // import.meta may not be available in standard CJS/Next.js bundle
  }
  return '';
};

const rawUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const rawKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

const supabaseUrl = (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '')
  ? rawUrl.trim()
  : 'https://placeholder.supabase.co';

const supabaseKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '')
  ? rawKey.trim()
  : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
