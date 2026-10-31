"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ExternalLink, GitCompareArrows, Heart, Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { resolveBasis, type EstimateBasis } from "@/lib/nutrition/basis";
import { activeChoices, type OptionGroup, type Selections } from "@/lib/nutrition/customize";
import { food, proteinPer100kcal } from "@/lib/nutrition/estimate";
import { fmtDate, fmtGrams, fmtKcal, fmtLikely, fmtNok, fmtRange, PROVIDER_LABEL, todayISO } from "@/lib/format";
import { useCompare } from "@/lib/client/compare";
import { track } from "@/lib/client/loading";
import { backend } from "@/lib/client/backend";
import type { MealView } from "@/server/repo/menu";
import { MacroBar } from "./MacroBar";
import { DemoBadge, ProvenanceChip } from "./Provenance";

const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function MealSheet({ meal, onClose, initialSelections = {}, isFavorite = false }: { meal: MealView; onClose: () => void; initialSelections?: Selections; isFavorite?: boolean }) {
  const [basis, setBasis] = useState<EstimateBasis>(meal.basis);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done">("idle");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [sel, setSel] = useState<Selections>(initialSelections);
  const [portion, setPortion] = useState(1);
  const [fav, setFav] = useState(isFavorite);
  const [logged, setLogged] = useState<null | number>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pending, start] = useTransition();
  const compare = useCompare();

  // Upgrade template estimates with AI (server caches the result per menu text).
  useEffect(() => {
    if (basis.kind === "official" || meal.sourceType === "typical") return;
    const isTemplate = (basis.kind === "archetype" || basis.kind === "components") && basis.provider === "template";
    if (!(isTemplate || basis.kind === "unavailable") || meal.model === "ai-fallback") return;
    setAiState("loading");
    track(backend.estimate(meal.id, true))
      .then((j) => {
        setBasis(j.basis);
        setAiNote(j.aiNote);
      })
      .catch(() => {})
      .finally(() => setAiState("done"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const resolved = useMemo(() => resolveBasis(basis, sel), [basis, sel]);
  // Facts stated on the menu (vs. assumed), e.g. "Meat: Chicken", "Pieces: 8 pcs".
  const knownFacts = useMemo(() => {
    if (basis.kind !== "archetype") return [];
    return resolved.options.flatMap((g) => {
      const v = basis.known[g.id];
      if (v === undefined) return [];
      if (g.kind === "count") return [`${g.label}: ${v} ${g.unit}`];
      const ids = Array.isArray(v) ? v : [String(v)];
      const labels = g.choices.filter((c) => ids.includes(c.id)).map((c) => c.label);
      return labels.length ? [`${g.label}: ${labels.join(", ")}`] : [];
    });
  }, [basis, resolved.options]);
  const e = resolved.estimate;

  const doLog = () =>
    start(async () => {
      setError(null);
      try {
        const r = await track(backend.logMeal({ menuItemId: meal.id, selections: sel, portion, day: todayISO() }));
        setLogged(r.kcal);
      } catch {
        setError("Couldn't log this meal. Please try again.");
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="meal-title">
      <motion.div className="absolute inset-0 bg-black/40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-surface pb-safe shadow-2xl md:rounded-[28px]"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {e && <ProvenanceChip status={e.status} provider={e.provider} />}
              {meal.restaurant.isDemo && <DemoBadge />}
              {meal.sourceType === "community" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">{meal.category === "Found online by AI" ? "Found online by AI" : "Added by a user"}</span>}
              {meal.sourceType === "typical" && <span className="rounded-full border border-dashed border-ink-3 px-2 py-0.5 text-[11px] text-ink-2">Typical dish · not their menu</span>}
            </div>
            <h2 id="meal-title" className="text-lg font-semibold leading-tight tracking-tight">{meal.name}</h2>
            <p className="truncate text-xs text-ink-2">
              {meal.restaurant.name}
              {meal.priceNok ? ` · ${fmtNok(meal.priceNok)}` : ""}
            </p>
          </div>
          {meal.addedByMe && (
            <button
              onClick={() => {
                if (!confirm(`Delete “${meal.name}”? Meals you already logged stay in your diary.`)) return;
                start(async () => {
                  await track(backend.deleteDishes([meal.id]));
                  onClose();
                });
              }}
              disabled={pending}
              className="rounded-full bg-surface-2 p-2 text-danger"
              aria-label="Delete this dish"
              title="Delete this dish"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {meal.description && <p className="text-sm text-ink-2">{meal.description}</p>}
          {meal.sourceType === "typical" && (
            <p className="rounded-xl border border-dashed border-line p-3 text-xs text-ink-2">
              This is a generic dish for this kind of restaurant, not something from {meal.restaurant.name}’s menu. Their version, portion and price may differ — use it as a rough guide.
            </p>
          )}
          {meal.sourceUrl && (meal.sourceType === "community" || meal.sourceType === "website") && (
            <p className="text-xs text-ink-2">
              {meal.sourceType === "website" ? "From their website" : "Menu source"}:{" "}
              <a href={meal.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{new URL(meal.sourceUrl).hostname.replace(/^www\./, "")}</a>
              {meal.sourceType === "website" ? `, checked ${fmtDate(meal.lastChecked)}` : ""} — check it’s current.
            </p>
          )}

          {aiState === "loading" && (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
              <Loader2 size={14} className="shrink-0 animate-spin" />
              {e ? "Refining estimate with AI ingredient analysis…" : "Working out the ingredients with AI — this can take up to a minute. Nutrients are then calculated from Matvaretabellen."}
            </p>
          )}
          {aiNote && aiState === "done" && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">{aiNote}</p>}

          {!e && aiState === "loading" ? null : !e ? (
            <div className="rounded-2xl border border-dashed border-line p-5 text-sm text-ink-2">
              <p className="font-medium text-ink">No nutrition estimate available</p>
              <p className="mt-1">{resolved.reason}</p>
              <p className="mt-2 text-xs">We don’t invent numbers when we can’t ground them in ingredients.</p>
            </div>
          ) : (
            <>
              <section aria-label="Nutrition">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-3">{e.status === "verified" ? "Calories (restaurant-published)" : e.status === "external" ? "Calories (reference average)" : "Estimated calories"}</p>
                    <p className="tabular text-3xl font-semibold tracking-tight">{fmtKcal(scale(e.values.kcal, portion), e.status)}</p>
                    {e.status !== "verified" && <p className="tabular text-xs text-ink-2">most likely ≈ {fmtLikely(e.values.kcal.likely * portion, 10)} kcal</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink-3">Protein / 100 kcal</p>
                    <p className="tabular text-lg font-semibold">{proteinPer100kcal(e.values).toFixed(1)} g</p>
                  </div>
                </div>
                <div className="mt-3"><MacroBar values={e.values} height={8} /></div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <Macro label="Protein" dot="bg-protein" value={fmtGrams(scale(e.values.protein, portion), e.status)} />
                  <Macro label="Carbs" dot="bg-carbs" value={fmtGrams(scale(e.values.carbs, portion), e.status)} />
                  <Macro label="Fat" dot="bg-fat" value={fmtGrams(scale(e.values.fat, portion), e.status)} />
                </dl>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <Mini label="Fiber" value={e.values.fiber ? fmtGrams(scale(e.values.fiber, portion), e.status) : "—"} />
                  <Mini label="Sugars" value={e.values.sugar ? fmtGrams(scale(e.values.sugar, portion), e.status) : "—"} />
                  <Mini label="Sodium" value={e.values.sodiumMg ? fmtGramsMg(scale(e.values.sodiumMg, portion), e.status) : "—"} />
                  <Mini label={e.status === "verified" ? "Weight" : "Assumed weight"} value={e.servingG ? fmtGrams(scale(e.servingG, portion), e.status) : "—"} />
                </dl>
              </section>

              {knownFacts.length > 0 && (
                <p className="text-xs text-ink-2"><span className="font-medium text-ink">From the menu text:</span> {knownFacts.join(" · ")}</p>
              )}
              {e.status !== "verified" && (e.mainUncertainty || resolved.unknowns.length > 0) && (
                <section className="rounded-2xl bg-warn-soft p-3 text-xs text-warn">
                  {e.mainUncertainty && <p><span className="font-semibold">Main uncertainty:</span> {e.mainUncertainty}</p>}
                  {resolved.unknowns.length > 0 && <p className="mt-0.5">Still unknown: {resolved.unknowns.join(", ")}. Answer below to narrow the range.</p>}
                </section>
              )}

              {resolved.options.length > 0 && (
                <section aria-label="Customize" className="space-y-3">
                  <h3 className="text-sm font-semibold">Customize your order</h3>
                  {resolved.options.map((g) => (
                    <OptionControl key={g.id} group={g} selections={resolved.selections} explicit={g.id in sel || (basis.kind === "archetype" && g.id in basis.known)} onChange={(v) => setSel((s) => ({ ...s, [g.id]: v }))} />
                  ))}
                  {Object.keys(sel).length > 0 && <button onClick={() => setSel({})} className="text-xs text-ink-2 underline underline-offset-4">Reset to menu defaults</button>}
                </section>
              )}

              {e.reference && (
                <p className="rounded-2xl border border-line p-3 text-xs text-ink-2">
                  <span className="font-medium text-ink">Cross-check:</span> Matvaretabellen’s analysed average for “{e.reference.label}” at this weight is{" "}
                  <span className="tabular font-medium text-ink">{fmtKcal(scale(e.reference.kcal, portion), "estimated")}</span>. Big gaps usually mean portion or sauce differences.
                </p>
              )}

              <section>
                <button onClick={() => setShowDetails((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold" aria-expanded={showDetails}>
                  How this was {e.status === "verified" ? "sourced" : "estimated"}
                  <ChevronDown size={16} className={`transition ${showDetails ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <Details meal={meal} estimate={e} portion={portion} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </>
          )}
        </div>

        {e && (
          <div className="sticky bottom-0 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
            {logged !== null ? (
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium"><Check size={18} className="text-good" />Logged ≈{fmtLikely(logged, 10)} kcal to today</p>
                <Link href="/diary" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">View diary</Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-surface-2" aria-label="Portion">
                  <button className="p-2.5" aria-label="Smaller portion" onClick={() => setPortion((p) => PORTIONS[Math.max(0, PORTIONS.indexOf(p) - 1)])}><Minus size={16} /></button>
                  <span className="tabular w-11 text-center text-sm font-medium">{portion}×</span>
                  <button className="p-2.5" aria-label="Larger portion" onClick={() => setPortion((p) => PORTIONS[Math.min(PORTIONS.length - 1, PORTIONS.indexOf(p) + 1)])}><Plus size={16} /></button>
                </div>
                {!(backend.mode === "server" && (meal.sourceType === "typical" || meal.sourceType === "website")) && <button aria-label={fav ? "Remove from saved" : "Save meal"} aria-pressed={fav} onClick={() => start(async () => setFav(await backend.toggleFavorite(meal.id, sel)))} className="rounded-xl bg-surface-2 p-2.5">
                  <Heart size={18} className={fav ? "fill-current text-danger" : ""} />
                </button>}
                <button aria-label="Compare" aria-pressed={compare.has(meal.id)} onClick={() => compare.toggle({ id: meal.id, selections: sel })} className={`rounded-xl p-2.5 ${compare.has(meal.id) ? "bg-ink text-bg" : "bg-surface-2"}`}>
                  <GitCompareArrows size={18} />
                </button>
                <button onClick={doLog} disabled={pending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition active:scale-[0.99] disabled:opacity-60">
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Log meal
                </button>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
            {compare.items.length > 0 && logged === null && (
              <Link href="/compare" className="mt-2 block text-center text-xs text-ink-2 underline underline-offset-4">Compare {compare.items.length} selected</Link>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

const scale = <T extends { min: number; likely: number; max: number }>(r: T, f: number) => ({ min: r.min * f, likely: r.likely * f, max: r.max * f });
const fmtGramsMg = (r: { min: number; likely: number; max: number }, s: Parameters<typeof fmtGrams>[1]) => fmtRange(r, s, " mg", 10);

function Macro({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] text-ink-2"><i className={`h-2 w-2 rounded-full ${dot}`} />{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="tabular font-medium text-ink-2">{value}</dd>
    </div>
  );
}

function OptionControl({ group, selections, explicit, onChange }: { group: OptionGroup; selections: Selections; explicit: boolean; onChange: (v: string | string[] | number) => void }) {
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-medium transition ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink"}`;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {group.label}
        {group.unknownLabel && !explicit && <span className="rounded bg-warn-soft px-1 text-[10px] text-warn">assumed</span>}
      </p>
      {group.kind === "count" ? (
        <div className="inline-flex items-center rounded-xl bg-surface-2">
          {(() => {
            const n = typeof selections[group.id] === "number" ? (selections[group.id] as number) : group.defaultCount;
            return (
              <>
                <button className="p-2" aria-label={`Fewer ${group.unit}`} onClick={() => onChange(Math.max(group.min, n - 1))}><Minus size={14} /></button>
                <span className="tabular w-16 text-center text-sm font-medium">{n} {group.unit}</span>
                <button className="p-2" aria-label={`More ${group.unit}`} onClick={() => onChange(Math.min(group.max, n + 1))}><Plus size={14} /></button>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5" role={group.kind === "single" ? "radiogroup" : "group"} aria-label={group.label}>
          {group.choices.map((c) => {
            const active = activeChoices(group, selections).some((x) => x.id === c.id);
            return (
              <button
                key={c.id}
                role={group.kind === "single" ? "radio" : "checkbox"}
                aria-checked={active}
                className={chip(active)}
                onClick={() => {
                  if (group.kind === "single") onChange(c.id);
                  else {
                    const cur = activeChoices(group, selections).map((x) => x.id);
                    onChange(active ? cur.filter((x) => x !== c.id) : [...cur, c.id]);
                  }
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Details({ meal, estimate: e, portion }: { meal: MealView; estimate: NonNullable<ReturnType<typeof resolveBasis>["estimate"]>; portion: number }) {
  return (
    <div className="space-y-3 pt-3 text-xs text-ink-2">
      <p>
        <span className="font-medium text-ink">Method:</span>{" "}
        {e.status === "verified"
          ? "Published by the restaurant."
          : e.status === "external"
            ? "Database average for this kind of dish (Matvaretabellen), scaled to an assumed portion."
            : ["gemini", "groq", "ollama", "anthropic", "free_ai"].includes(e.provider)
              ? `${PROVIDER_LABEL[e.provider]}: an AI read the dish name and description and suggested likely ingredients and amounts. The AI does not see or measure the food; every nutrient value is calculated from Matvaretabellen for those assumed ingredients.`
              : `${PROVIDER_LABEL[e.provider]}: likely ingredients and portions are inferred from the menu text; every nutrient value comes from food-composition data.`}
      </p>
      {e.assumptions.length > 0 && (
        <ul className="list-disc space-y-1 pl-4">
          {e.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
      {e.components.length > 0 && (
        <table className="w-full text-left">
          <thead className="text-ink-3">
            <tr><th className="py-1 font-medium">Ingredient (assumed)</th><th className="py-1 text-right font-medium">Assumed grams</th><th className="py-1 text-right font-medium">≈ kcal</th></tr>
          </thead>
          <tbody className="tabular">
            {e.components.map((c, i) => {
              const f = food(c.foodKey);
              return (
                <tr key={`${c.foodKey}-${i}`} className="border-t border-line">
                  <td className="py-1 pr-2">{f.label}{c.note ? <span className="text-ink-3"> · {c.note}</span> : null}</td>
                  <td className="py-1 text-right">{Math.round(c.grams.min * portion)}–{Math.round(c.grams.max * portion)}</td>
                  <td className="py-1 text-right">{Math.round((c.grams.likely * portion * f.per100g.kcal) / 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div>
        <p className="font-medium text-ink">Sources</p>
        <ul className="mt-1 space-y-0.5">
          {e.sources.map((s) => (
            <li key={s.url + s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                {s.db}{s.id ? ` ${s.id}` : ""}: {s.label}<ExternalLink size={11} />
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p>
        Menu {meal.sourceType === "demo" ? "is illustrative demo data" : meal.sourceType === "typical" ? "item is a generic typical dish, not from this restaurant" : meal.sourceType === "website" ? "item read automatically from the restaurant’s website" : meal.sourceType === "community" ? "item added by a user" : "from the restaurant"} · last checked {fmtDate(meal.lastChecked)} · nutrition computed {fmtDate(e.computedAt)}.
        {e.status !== "verified" && " Estimates can be wrong — restaurants vary portions and recipes."}
      </p>
    </div>
  );
}
