"use client";
import { useMemo } from "react";
import { resolveBasis } from "@/lib/nutrition/basis";
import { fmtGrams, fmtKcal, fmtNok } from "@/lib/format";
import type { MealView } from "@/server/repo/menu";
import { MacroBar } from "./MacroBar";
import { ProvenanceChip } from "./Provenance";

export function MealRow({ meal, onOpen, extra }: { meal: MealView; onOpen: () => void; extra?: React.ReactNode }) {
  const e = useMemo(() => resolveBasis(meal.basis).estimate, [meal.basis]);
  return (
    <button onClick={onOpen} className="card block w-full p-4 text-left transition hover:border-ink-3/40 active:scale-[0.995]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug tracking-tight">{meal.name}</h3>
          {meal.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{meal.description}</p>}
        </div>
        {meal.priceNok != null && <span className="tabular shrink-0 text-sm text-ink-2">{fmtNok(meal.priceNok)}</span>}
      </div>
      {e ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular text-base font-semibold">{fmtKcal(e.values.kcal, e.status)}</span>
            <span className="tabular text-sm text-ink-2"><span className="text-protein">●</span> {fmtGrams(e.values.protein, e.status)} protein</span>
            <span className="ml-auto"><ProvenanceChip status={e.status} provider={e.provider} compact /></span>
          </div>
          <div className="mt-2"><MacroBar values={e.values} /></div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">No estimate yet — open to analyse with AI</p>
      )}
      {extra}
    </button>
  );
}
