import { createClient } from '@supabase/supabase-js';

// Direct static access allows Next.js (Webpack/Turbopack) to inline NEXT_PUBLIC_* variables into the client bundle
const rawUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof process !== 'undefined' && process.env ? process.env.VITE_SUPABASE_URL : '') ||
  '';

const rawKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && process.env ? process.env.VITE_SUPABASE_ANON_KEY : '') ||
  '';

const supabaseUrl = (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '')
  ? rawUrl.trim()
  : 'https://placeholder.supabase.co';

const supabaseKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '')
  ? rawKey.trim()
  : 'placeholder-anon-key';

if (typeof window !== 'undefined') {
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-anon-key') {
    console.error(
      '[LeafLearn Supabase Client] LỖI CẤU HÌNH: Không tìm thấy NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Vui lòng kiểm tra file .env.local hoặc .env.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);
