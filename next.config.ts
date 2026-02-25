import type { NextConfig } from "next";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:8000";
const isLocalBackend = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(PYTHON_BACKEND_URL);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    if (process.env.VERCEL === "1" && isLocalBackend) {
      return [];
    }

    return [
      {
        source: "/py/:path*",
        destination: `${PYTHON_BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
