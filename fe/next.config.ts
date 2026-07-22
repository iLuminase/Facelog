import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

const lanDevOrigins = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === 'IPv4' && !entry.internal)
  .map((entry) => entry.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins,
  async rewrites() {
    const backendApiUrl = (process.env.BACKEND_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
