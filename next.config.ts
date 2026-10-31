import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

/**
 * Two builds:
 *  - default: full Next.js server (API routes, server actions, Postgres).
 *  - STATIC_EXPORT=1 (npm run build:static): a static site for GitHub Pages
 *    where everything runs in the browser (src/lib/client/backend.local.ts).
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = isStatic ? process.env.NEXT_PUBLIC_BASE_PATH || "" : "";
const backendImpl = fileURLToPath(new URL(`./src/lib/client/backend.${isStatic ? "local" : "remote"}.ts`, import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  env: { NEXT_PUBLIC_STATIC: isStatic ? "1" : "0", NEXT_PUBLIC_BASE_PATH: basePath },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@backend-impl": backendImpl };
    return config;
  },
  ...(isStatic
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
        // Only .tsx files are routes in the static build, which leaves out the
        // server-only route handlers (route.ts) and middleware.ts.
        pageExtensions: ["tsx", "jsx", "js"],
      }
    : {
        // PGlite ships WASM + data files that must be loaded from node_modules, not bundled.
        serverExternalPackages: ["@electric-sql/pglite"],
        outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
        // Codespaces/other proxies forward the app under a different host; allow server actions from them.
        experimental: { serverActions: { allowedOrigins: ["localhost:3000", "*.app.github.dev"] } },
      }),
};

export default nextConfig;
