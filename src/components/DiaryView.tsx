"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Trash2, UtensilsCrossed } from "lucide-react";
import { deleteEntryAction, repeatEntry, setEntryPortion } from "@/app/actions";
import { fmtDay, fmtLikely, PROVIDER_LABEL, shiftDay } from "@/lib/format";
import type { Goals } from "@/lib/scoring";
import type { DataStatus, EstimateProvider } from "@/lib/nutrition/types";
import { ProvenanceChip } from "./Provenance";
import { ProgressBar, Ring } from "./Ring";

interface Entry {
  id: string;
  name: string;
  restaurantName: string | null;
  portion: number;
  status: string;
  provider: string;
  kcal: number;
  kcalMin: number;
  kcalMax: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: string;
}

const GOAL_LABEL: Record<Goals["goalType"], string> = { cut: "Cutting", bulk: "Bulking", maintain: "Maintaining", healthy: "Healthy eating", custom: "Custom targets" };

export function DiaryView(props: {
  day: string;
  today: string;
  goals: Goals;
  entries: Entry[];
  totals: { kcal: number; kcalMin: number; kcalMax: number; protein: number; carbs: number; fat: number };
  recent: { id: string; name: string; restaurantName: string | null; kcal: number; protein: number }[];
  week: { day: string; kcal: number }[];
}) {
  const { day, today, goals } = props;
  const [pending, start] = useTransition();
  const [entries, update] = useOptimistic(props.entries, (cur: Entry[], a: { type: "portion"; id: string; portion: number } | { type: "delete"; id: string }) =>
    a.type === "delete" ? cur.filter((e) => e.id !== a.id) : cur.map((e) => (e.id === a.id ? { ...e, portion: a.portion } : e)),
  );
  const t = entries.reduce((s, e) => ({ kcal: s.kcal + e.kcal * e.portion, min: s.min + e.kcalMin * e.portion, max: s.max + e.kcalMax * e.portion, protein: s.protein + e.protein * e.portion, carbs: s.carbs + e.carbs * e.portion, fat: s.fat + e.fat * e.portion }), { kcal: 0, min: 0, max: 0, protein: 0, carbs: 0, fat: 0 });
  const remaining = goals.kcalTarget - t.kcal;
  const hasEstimates = entries.some((e) => e.status !== "verified");
  const maxWeek = Math.max(goals.kcalTarget, ...props.week.map((d) => d.kcal)) * 1.05;

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Diary · {GOAL_LABEL[goals.goalType]}</p>
          <h1 className="text-xl font-semibold tracking-tight">{day === today ? "Today" : fmtDay(day)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/diary?day=${shiftDay(day, -1)}`} className="rounded-full bg-surface-2 p-2" aria-label="Previous day"><ChevronLeft size={18} /></Link>
          {day !== today && <Link href="/diary" className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium">Today</Link>}
          {day < today && <Link href={`/diary?day=${shiftDay(day, 1)}`} className="rounded-full bg-surface-2 p-2" aria-label="Next day"><ChevronRight size={18} /></Link>}
        </div>
      </header>

      <section className="card flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center">
        <Ring value={t.kcal} target={goals.kcalTarget}>
          <span className="tabular text-3xl font-semibold tracking-tight">{fmtLikely(Math.abs(remaining), 10)}</span>
          <span className="text-xs text-ink-2">{remaining >= 0 ? "kcal remaining" : "kcal over"}</span>
        </Ring>
        <div className="w-full flex-1 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Eaten</span>
            <span className="tabular font-medium">
              ≈{fmtLikely(t.kcal, 10)} / {fmtLikely(goals.kcalTarget)} kcal
            </span>
          </div>
          {hasEstimates && t.kcal > 0 && (
            <p className="tabular -mt-2 text-right text-[11px] text-ink-3">Range from estimates: {fmtLikely(t.min, 10)}–{fmtLikely(t.max, 10)} kcal</p>
          )}
          <ProgressBar label="Protein" value={t.protein} target={goals.proteinG} colorClass="bg-protein" />
          <ProgressBar label="Carbs" value={t.carbs} target={goals.carbsG} colorClass="bg-carbs" />
          <ProgressBar label="Fat" value={t.fat} target={goals.fatG} colorClass="bg-fat" />
          <p className="text-[11px] text-ink-3">
            Protein left: <span className="tabular font-medium text-ink-2">{Math.max(0, Math.round(goals.proteinG - t.protein))} g</span> ·{" "}
            <Link href="/search?q=fits my remaining budget" className="underline underline-offset-2">Find a meal that fits</Link>
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Meals</h2>
        {entries.length === 0 ? (
          <div className="card flex flex-col items-center p-8 text-center">
            <UtensilsCrossed className="mb-2 text-ink-3" />
            <p className="text-sm font-medium">Nothing logged {day === today ? "yet today" : "this day"}</p>
            <Link href="/" className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Find a restaurant meal</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{e.name}</p>
                    <p className="text-xs text-ink-2">
                      {e.restaurantName ?? ""} · {new Date(e.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-semibold">
                      {e.status === "verified" ? fmtLikely(e.kcal * e.portion) : `${fmtLikely(e.kcalMin * e.portion, 10)}–${fmtLikely(e.kcalMax * e.portion, 10)}`} kcal
                    </p>
                    <p className="tabular text-xs text-ink-2">{Math.round(e.protein * e.portion)} g protein</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <ProvenanceChip status={e.status as DataStatus} provider={e.provider as EstimateProvider} compact />
                  <span className="sr-only">{PROVIDER_LABEL[e.provider as EstimateProvider]}</span>
                  <div className="ml-auto flex items-center rounded-xl bg-surface-2" aria-label="Portion">
                    <button disabled={pending} className="p-2" aria-label="Decrease portion" onClick={() => change(e, -0.25)}><Minus size={14} /></button>
                    <span className="tabular w-12 text-center text-xs font-medium">{e.portion}×</span>
                    <button disabled={pending} className="p-2" aria-label="Increase portion" onClick={() => change(e, 0.25)}><Plus size={14} /></button>
                  </div>
                  <button disabled={pending} aria-label="Log again" title="Log again today" className="rounded-xl bg-surface-2 p-2" onClick={() => start(() => repeatEntry(e.id))}><RotateCcw size={14} /></button>
                  <button disabled={pending} aria-label="Delete entry" className="rounded-xl bg-surface-2 p-2 text-danger" onClick={() => start(async () => { update({ type: "delete", id: e.id }); await deleteEntryAction(e.id); })}><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {props.recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Log again</h2>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {props.recent.map((r) => (
              <li key={r.id} className="shrink-0">
                <button disabled={pending} onClick={() => start(() => repeatEntry(r.id, day))} className="card w-44 p-3 text-left transition hover:border-ink-3/40">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-[11px] text-ink-2">{r.restaurantName}</p>
                  <p className="tabular mt-1 text-xs text-ink-2">≈{fmtLikely(r.kcal, 10)} kcal · {Math.round(r.protein)} g P</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Last 7 days</h2>
        <div className="card p-4">
          <div className="relative flex h-32 items-end gap-2" role="img" aria-label="Calories per day for the last 7 days">
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3/60" style={{ bottom: `${(goals.kcalTarget / maxWeek) * 100}%` }}>
              <span className="absolute -top-4 right-0 text-[10px] text-ink-3">target {Math.round(goals.kcalTarget)}</span>
            </div>
            {props.week.map((d) => (
              <Link key={d.day} href={`/diary?day=${d.day}`} className="group flex h-full flex-1 flex-col justify-end" title={`${fmtDay(d.day)}: ${Math.round(d.kcal)} kcal`}>
                <div className={`w-full rounded-t-[4px] ${d.day === day ? "bg-ink" : "bg-ink-3/50 group-hover:bg-ink-3"}`} style={{ height: `${Math.max(2, (d.kcal / maxWeek) * 100)}%` }} />
              </Link>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {props.week.map((d) => (
              <span key={d.day} className="flex-1 text-center text-[10px] text-ink-3">{fmtDay(d.day).split(" ")[0]}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  function change(e: Entry, delta: number) {
    const portion = Math.min(5, Math.max(0.25, Math.round((e.portion + delta) * 100) / 100));
    start(async () => {
      update({ type: "portion", id: e.id, portion });
      await setEntryPortion(e.id, portion);
    });
  }
}
