import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['2a20-223-181-57-33.ngrok-free.app', '192.168.137.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
};

export default nextConfig;
