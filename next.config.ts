import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Share links used to live under /xem; keep links already sent out working.
  async redirects() {
    return [{ source: '/xem/:token', destination: '/view/:token', permanent: true }];
  },
};

export default nextConfig;
