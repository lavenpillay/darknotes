import type { NextConfig } from 'next';

const API_ORIGIN = process.env.DARKNOTES_API_ORIGIN ?? 'http://127.0.0.1:3737';

const config: NextConfig = {
  transpilePackages: ['@darknotes/core'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/health', destination: `${API_ORIGIN}/health` },
    ];
  },
};

export default config;
