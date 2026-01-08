import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;

    // Vercel 환경에서만 API 프록시
    if (backendUrl) {
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
