import type { NextConfig } from "next";

/**
 * When API_PROXY_TARGET is set, browser calls stay same-origin (`/api/v1/...`)
 * and Next proxies to the Express API. That makes the session cookie first-party
 * (required on Render: frontend and API are different hosts).
 *
 * Example: API_PROXY_TARGET=https://mahir-pay-prototype.onrender.com
 */
const apiProxyTarget = (process.env.API_PROXY_TARGET ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  agentRules: false,
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
