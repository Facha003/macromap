import "server-only";
import { cached } from "../cache";
import { osmUserAgent } from "./userAgent";

export interface GeocodeResult { label: string; lat: number; lng: number }

let queue: Promise<unknown> = Promise.resolve();

/** Nominatim's usage policy allows at most 1 request per second. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(() => new Promise((r) => setTimeout(r, 1100)), () => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return cached(`nominatim:${q}`, 7 * 24 * 3600_000, () =>
    throttled(async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "user-agent": osmUserAgent(), "accept-language": "en,nb" }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const json = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      return json.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
    }),
  );
}
