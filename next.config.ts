import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // Codespaces/other proxies forward the app under a different host; allow server actions from them.
  experimental: { serverActions: { allowedOrigins: ["localhost:3000", "*.app.github.dev"] } },
  // PGlite ships WASM + data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
