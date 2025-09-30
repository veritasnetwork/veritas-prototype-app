/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/supabase/:path*',
        destination: 'http://127.0.0.1:54321/:path*',
      },
    ];
  },
};

export default nextConfig;