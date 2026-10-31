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
          <h3 className="font-semibold leading-snug tracking-tight">
            {meal.name}
            <SourceTag meal={meal} />
          </h3>
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

/** Where the dish itself comes from (separate from where its nutrition comes from). */
export function SourceTag({ meal }: { meal: MealView }) {
  const tag =
    meal.sourceType === "typical"
      ? { text: "Typical · not confirmed on menu", cls: "border border-dashed border-ink-3 text-ink-2" }
      : meal.sourceType === "website"
        ? { text: "From restaurant website", cls: "bg-surface-2 text-ink-2" }
        : meal.sourceType === "official"
          ? { text: "Restaurant-published", cls: "bg-good-soft text-good" }
          : meal.sourceType === "demo"
            ? { text: "Demo menu", cls: "border border-dashed border-ink-3 text-ink-3" }
            : meal.category === "Found online by AI"
              ? { text: "Found online (AI)", cls: "bg-surface-2 text-ink-2" }
              : { text: "Added by a user", cls: "bg-surface-2 text-ink-2" };
  return <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium ${tag.cls}`}>{tag.text}</span>;
}
