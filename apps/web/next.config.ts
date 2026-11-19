import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@bosla/shared', '@bosla/ui'],
};

export default nextConfig;
