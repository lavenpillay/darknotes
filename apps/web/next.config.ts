import type { NextConfig } from 'next';

const API_ORIGIN = process.env.DARKNOTES_API_ORIGIN ?? 'http://127.0.0.1:3737';

/**
 * Development (`next dev`): a normal Next.js server that proxies /api to the DarkNotes server.
 * Production (`next build`): a fully static export into out/, served by the DarkNotes server itself on one port,
 * so there is no proxy and no second process. The app uses no server-only Next.js features.
 */
const isProduction = process.env.NODE_ENV === 'production';

const config: NextConfig = {
  transpilePackages: ['@darknotes/core'],
  ...(isProduction
    ? { output: 'export' }
    : {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
            { source: '/health', destination: `${API_ORIGIN}/health` },
          ];
        },
      }),
};

export default config;
