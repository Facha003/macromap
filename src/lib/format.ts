import type { DataStatus, EstimateProvider, Range } from "./nutrition/types";

const round = (v: number, step: number) => Math.round(v / step) * step;

/** Verified values print as one number; anything else prints as a range. */
export function fmtRange(r: Range, status: DataStatus, unit: string, step = 1): string {
  if (status === "verified" || r.max - r.min < step) return `${round(r.likely, step)}${unit}`;
  const lo = round(r.min, step);
  const hi = Math.max(lo + step, round(r.max, step));
  return `${lo}–${hi}${unit}`;
}

export const fmtKcal = (r: Range, s: DataStatus) => fmtRange(r, s, " kcal", 10);
export const fmtGrams = (r: Range, s: DataStatus) => fmtRange(r, s, " g", 1);

export function fmtLikely(v: number, step = 1) {
  return String(round(v, step));
}

export const PROVIDER_LABEL: Record<EstimateProvider | "none", string> = {
  official: "Restaurant",
  reference_db: "Matvaretabellen dish average",
  curated: "Ingredient model",
  template: "Template estimate",
  gemini: "AI estimate · Gemini",
  groq: "AI estimate · Groq",
  ollama: "AI estimate · Ollama",
  anthropic: "AI estimate · Claude",
  free_ai: "AI estimate · free AI",
  none: "No estimate",
};

export function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** YYYY-MM-DD in the given time zone (browser zone on the client, APP_TIMEZONE on the server). */
export function todayISO(d = new Date(), timeZone?: string) {
  const tz = timeZone ?? (typeof window === "undefined" ? process.env.APP_TIMEZONE || "Europe/Oslo" : undefined);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function fmtDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtNok(v: number | null | undefined) {
  return v == null ? null : `${Math.round(v)} kr`;
}
