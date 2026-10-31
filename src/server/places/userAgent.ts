import "server-only";

/** OSM services require an identifying User-Agent with contact details. */
export function osmUserAgent(): string {
  return `MacroMap/0.1 (${process.env.CONTACT_EMAIL || "set CONTACT_EMAIL in .env"})`;
}
