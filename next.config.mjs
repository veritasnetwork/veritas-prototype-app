/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Local development
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      // Production Supabase
      // TODO: Replace with your actual Supabase project URL when deploying
      // {
      //   protocol: 'https',
      //   hostname: '*.supabase.co',
      //   pathname: '/storage/v1/object/public/**',
      // },
      // Production CDN (if using a custom domain)
      // {
      //   protocol: 'https',
      //   hostname: 'cdn.yourdomain.com',
      //   pathname: '/**',
      // },
    ],
  },
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