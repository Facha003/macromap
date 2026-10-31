import type { DataStatus, Range } from "@/lib/nutrition/types";
import { fmtRange } from "@/lib/format";

/**
 * The only way nutrition numbers are rendered. `status` is required so a value
 * can never appear without its reliability; estimates always render as ranges.
 */
export function NutritionValue({ range, status, unit, step = 1, className = "" }: { range: Range; status: DataStatus; unit: string; step?: number; className?: string }) {
  return <span className={`tabular ${className}`}>{fmtRange(range, status, unit, step)}</span>;
}
