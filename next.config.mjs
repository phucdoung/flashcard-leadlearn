/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
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
