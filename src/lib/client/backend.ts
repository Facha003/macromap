/**
 * The app's data access for client components. `@backend-impl` resolves to the
 * server-backed implementation by default; `npm run build:static` (GitHub Pages)
 * aliases it to the browser-only implementation in next.config.ts.
 */
export { backend } from "@backend-impl";
export type * from "./backendTypes";
