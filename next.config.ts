import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization
  // output: 'standalone',  // Temporarily disabled for debugging

  // Disable ESLint during builds temporarily to debug
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },

  // PWA configuration
  // experimental: {
  //   optimizeCss: true,
  // },

  // Webpack optimization for dev mode memory reduction
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Use lighter source maps in development (less memory)
      config.devtool = 'eval-cheap-source-map';

      // Disable module concatenation in dev (faster rebuilds, less memory)
      config.optimization = {
        ...config.optimization,
        concatenateModules: false,
      };
    }

    // Externalize server-only packages when bundling for client
    if (!isServer) {
      config.externals = config.externals || [];

      // Add server-only modules that should never be bundled for client
      const serverOnlyModules = [
        '@coral-xyz/anchor',
        'fs',
        'path',
        'crypto',
      ];

      if (Array.isArray(config.externals)) {
        config.externals.push(...serverOnlyModules);
      }
    }

    return config;
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
