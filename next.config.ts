import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only packages that genuinely can't be bundled (native/binary assets,
  // external CLI binaries) belong here. Pure-JS/ESM packages like deepagents
  // and @langchain/quickjs must NOT be listed: externalizing them makes
  // Turbopack `require()` them at runtime, which fails with "Cannot use
  // import statement outside a module" since they ship as ESM.
  serverExternalPackages: ["agent-browser", "@sparticuz/chromium"]
};

export default nextConfig;
