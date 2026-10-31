import type { NutritionValues } from "@/lib/nutrition/types";

/** Energy split by macro (protein/carbs 4 kcal/g, fat 9 kcal/g), with a 2px gap between segments. */
export function MacroBar({ values, height = 6 }: { values: NutritionValues; height?: number }) {
  const p = values.protein.likely * 4;
  const c = values.carbs.likely * 4;
  const f = values.fat.likely * 9;
  const total = p + c + f || 1;
  const seg = [
    { k: "protein", v: p, cls: "bg-protein" },
    { k: "carbs", v: c, cls: "bg-carbs" },
    { k: "fat", v: f, cls: "bg-fat" },
  ].filter((s) => s.v > 0);
  return (
    <div className="flex w-full gap-[2px]" style={{ height }} role="img" aria-label={`Energy from protein ${Math.round((p / total) * 100)}%, carbs ${Math.round((c / total) * 100)}%, fat ${Math.round((f / total) * 100)}%`}>
      {seg.map((s, i) => (
        <div key={s.k} className={`${s.cls} ${i === 0 ? "rounded-l-full" : ""} ${i === seg.length - 1 ? "rounded-r-full" : ""}`} style={{ width: `${(s.v / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function MacroLegend() {
  return (
    <div className="flex gap-3 text-[11px] text-ink-2">
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-protein" />Protein</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-carbs" />Carbs</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-fat" />Fat</span>
    </div>
  );
}
