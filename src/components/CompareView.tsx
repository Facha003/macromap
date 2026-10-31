"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { formatDistance, haversineM } from "@/lib/geo";
import { resolveBasis } from "@/lib/nutrition/basis";
import { proteinPer100kcal, rangeWidth } from "@/lib/nutrition/estimate";
import type { NutritionEstimate } from "@/lib/nutrition/types";
import { fmtGrams, fmtKcal, fmtNok } from "@/lib/format";
import { useCompare } from "@/lib/client/compare";
import { useLocation } from "@/lib/client/location";
import { track } from "@/lib/client/loading";
import { backend } from "@/lib/client/backend";
import type { MealView } from "@/server/repo/menu";
import { MacroBar } from "./MacroBar";
import { ProvenanceChip } from "./Provenance";

interface Col { meal: MealView; e: NutritionEstimate }

export function CompareView() {
  const { items, remove, clear } = useCompare();
  const { location } = useLocation();
  const [meals, setMeals] = useState<MealView[] | null>(null);

  const ids = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!ids) {
      setMeals([]);
      return;
    }
    track(backend.meals(ids.split(","))).then(setMeals).catch(() => setMeals([]));
  }, [ids]);

  const cols: Col[] = useMemo(
    () =>
      items.flatMap((it) => {
        const meal = meals?.find((m) => m.id === it.id);
        const e = meal ? resolveBasis(meal.basis, it.selections).estimate : null;
        return meal && e ? [{ meal, e }] : [];
      }),
    [items, meals],
  );

  const dist = (m: MealView) => (location ? haversineM(location, m.restaurant) : null);

  type Row = { label: string; render: (c: Col) => React.ReactNode; best?: (c: Col) => number; higherBetter?: boolean };
  const rows: Row[] = [
    { label: "Calories", render: (c) => fmtKcal(c.e.values.kcal, c.e.status) },
    { label: "Protein", render: (c) => fmtGrams(c.e.values.protein, c.e.status), best: (c) => c.e.values.protein.likely, higherBetter: true },
    { label: "Protein / 100 kcal", render: (c) => `${proteinPer100kcal(c.e.values).toFixed(1)} g`, best: (c) => proteinPer100kcal(c.e.values), higherBetter: true },
    { label: "Carbs", render: (c) => fmtGrams(c.e.values.carbs, c.e.status) },
    { label: "Fat", render: (c) => fmtGrams(c.e.values.fat, c.e.status) },
    { label: "Fiber", render: (c) => (c.e.values.fiber ? fmtGrams(c.e.values.fiber, c.e.status) : "—") },
    { label: "Portion", render: (c) => (c.e.servingG ? fmtGrams(c.e.servingG, c.e.status) : "—") },
    { label: "Price", render: (c) => fmtNok(c.meal.priceNok) ?? "—", best: (c) => c.meal.priceNok ?? Infinity, higherBetter: false },
    { label: "Protein per 100 kr", render: (c) => (c.meal.priceNok ? `${((c.e.values.protein.likely / c.meal.priceNok) * 100).toFixed(1)} g` : "—"), best: (c) => (c.meal.priceNok ? c.e.values.protein.likely / c.meal.priceNok : 0), higherBetter: true },
    { label: "Distance", render: (c) => formatDistance(dist(c.meal)) || "—", best: (c) => dist(c.meal) ?? Infinity, higherBetter: false },
    { label: "Data", render: (c) => <span className="flex flex-col items-start gap-1"><ProvenanceChip status={c.e.status} provider={c.e.provider} compact /><span className="text-[10px] text-ink-3">±{Math.round((rangeWidth(c.e.values.kcal) / 2) * 100)}% kcal</span></span> },
  ];

  const bestIdx = (r: Row) => {
    if (!r.best || cols.length < 2) return -1;
    const vals = cols.map(r.best);
    const target = r.higherBetter ? Math.max(...vals) : Math.min(...vals);
    if (!Number.isFinite(target) || target === 0) return -1;
    return vals.indexOf(target);
  };

  return (
    <div>
      <Link href="/search" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2"><ArrowLeft size={16} />Search</Link>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Compare</p>
          <h1 className="text-xl font-semibold tracking-tight">Side by side</h1>
        </div>
        {cols.length > 0 && <button onClick={clear} className="text-xs text-ink-2 underline underline-offset-4">Clear all</button>}
      </div>

      {meals === null ? (
        <div className="h-64 animate-pulse rounded-[20px] bg-surface-2" />
      ) : cols.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-2">
          Add up to 4 meals with the compare button on any meal, then come back here.
          <div className="mt-3"><Link href="/search?q=chicken" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Compare chicken dishes</Link></div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 112 + cols.length * 150 }}>
            <thead>
              <tr className="border-b border-line">
                <th className="w-28 p-3" />
                {cols.map((c) => (
                  <th key={c.meal.id} className="p-3 text-left align-top font-normal">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-snug">{c.meal.name}</p>
                        <p className="text-xs text-ink-2">{c.meal.restaurant.name}</p>
                      </div>
                      <button onClick={() => remove(c.meal.id)} aria-label={`Remove ${c.meal.name}`} className="rounded-full p-1 text-ink-3 hover:bg-surface-2"><X size={14} /></button>
                    </div>
                    <div className="mt-2"><MacroBar values={c.e.values} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => {
                const b = bestIdx(r);
                return (
                  <tr key={r.label} className="border-b border-line last:border-0">
                    <th scope="row" className="p-3 text-left text-xs font-medium text-ink-2">{r.label}</th>
                    {cols.map((c, i) => (
                      <td key={c.meal.id} className={`p-3 ${i === b ? "font-semibold" : ""}`}>
                        {r.render(c)}
                        {i === b && <span className="ml-1.5 rounded bg-good-soft px-1 text-[10px] font-medium text-good">best</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-3">Ranges reflect estimate uncertainty. “Best” compares the most likely values only — overlapping ranges mean the difference may not be real.</p>
    </div>
  );
}
