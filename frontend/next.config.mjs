/** @type {import('next').NextConfig} */
const backendProxyTarget =
  process.env.BACKEND_PROXY_TARGET?.trim() || "http://127.0.0.1:8000";
const aiProxyTarget = process.env.AI_PROXY_TARGET?.trim() || "http://127.0.0.1:8001";

const nextConfig = {
  reactStrictMode: true,
  // Add webpack configuration for better Docker stability on Windows
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendProxyTarget.replace(/\/$/, "")}/:path*`,
      },
      {
        source: "/ai/:path*",
        destination: `${aiProxyTarget.replace(/\/$/, "")}/ai/:path*`,
      },
    ];
  },
};

export default nextConfig;

