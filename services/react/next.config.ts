import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'http://10.43.103.145.nip.io:9081/:path*',
      },
    ];
  },
};

export default nextConfig;
