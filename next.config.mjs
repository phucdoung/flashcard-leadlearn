import fs from 'node:fs';
import path from 'node:path';

function loadFallbackEnv() {
  const envFiles = ['.env.local', '.env'];
  const envMap = {};

  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        content.split('\n').forEach((line) => {
          const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!(key in envMap) && val) {
              envMap[key] = val;
            }
          }
        });
      } catch (_e) {
        // ignore read error
      }
    }
  }
  return envMap;
}

const fallbackEnvs = loadFallbackEnv();

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  fallbackEnvs.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  fallbackEnvs.VITE_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fallbackEnvs.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  fallbackEnvs.VITE_SUPABASE_ANON_KEY ||
  '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/explore',
        destination: '/community',
        permanent: true,
      },
      {
        source: '/quiz/history',
        destination: '/statistics',
        permanent: true,
      },
      {
        source: '/quiz/result/:id',
        destination: '/result/:id',
        permanent: false,
      },
      {
        source: '/quiz/:id/result',
        destination: '/result/:id',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
