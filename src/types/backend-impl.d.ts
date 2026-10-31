// Resolved by a webpack alias in next.config.ts (server vs static build).
declare module "@backend-impl" {
  export const backend: import("@/lib/client/backendTypes").Backend;
}
