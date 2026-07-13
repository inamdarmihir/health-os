import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "deepagents",
    "@langchain/quickjs",
    "agent-browser",
    "@sparticuz/chromium"
  ]
};

export default nextConfig;
