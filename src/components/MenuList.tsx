"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardPaste, ExternalLink, Globe, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { parseMenuText, type ParsedDish } from "@/lib/menuParse";
import type { FoundMenu } from "@/lib/menuFinder";
import { containsPork } from "@/lib/halal";
import { resolveBasis } from "@/lib/nutrition/basis";
import { fmtNok } from "@/lib/format";
import { track } from "@/lib/client/loading";
import { backend, type NewDish } from "@/lib/client/backend";
import type { MealView } from "@/server/repo/menu";
import { MealRow } from "./MealRow";
import { MealSheet } from "./MealSheet";

export function MenuList({ meals, favoriteIds, restaurantId, restaurantName, website, isDemo, aiEnabled, halalOnly, onChanged }: { meals: MealView[]; favoriteIds: string[]; restaurantId: string; restaurantName: string; website: string | null; isDemo: boolean; aiEnabled: boolean; halalOnly: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<MealView | null>(null);
  // Halal mode hides dishes whose estimated recipe contains pork.
  const { visible, hidden } = useMemo(() => {
    if (!halalOnly) return { visible: meals, hidden: 0 };
    const v = meals.filter((m) => {
      const e = resolveBasis(m.basis).estimate;
      return !(e && containsPork(e.components));
    });
    return { visible: v, hidden: meals.length - v.length };
  }, [meals, halalOnly]);
  const groups = visible.reduce<Record<string, MealView[]>>((acc, m) => {
    (acc[m.category ?? "Menu"] ??= []).push(m);
    return acc;
  }, {});
  const typicalOnly = meals.length > 0 && meals.every((m) => m.sourceType === "typical");
  const mine = meals.filter((m) => m.addedByMe);
  const [deleting, setDeleting] = useState(false);
  const deleteMine = async () => {
    if (!confirm(`Delete all ${mine.length} dishes you added to this restaurant? Meals you already logged stay in your diary.`)) return;
    setDeleting(true);
    try {
      await track(backend.deleteDishes(mine.map((m) => m.id)));
      onChanged();
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      {hidden > 0 && <p className="mb-3 text-xs text-ink-2">Halal only: hid {hidden} dish{hidden === 1 ? "" : "es"} with pork.</p>}
      {!isDemo && (typicalOnly || meals.length === 0) && (
        <AddDishes restaurantId={restaurantId} restaurantName={restaurantName} website={website} isDemo={isDemo} aiEnabled={aiEnabled} startOpen onAdded={onChanged} />
      )}
      {Object.entries(groups).map(([cat, items]) => (
        <section key={cat} className="mb-6 mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{cat}</h2>
          {items[0]?.sourceType === "typical" && <p className="-mt-1 mb-2 text-xs text-ink-3">Generic dishes for this kind of restaurant — not from their menu. Prices unknown.</p>}
          <ul className="space-y-2">
            {items.map((m) => (
              <li key={m.id}><MealRow meal={m} onOpen={() => setOpen(m)} /></li>
            ))}
          </ul>
        </section>
      ))}
      {mine.length > 0 && (
        <button onClick={deleteMine} disabled={deleting} className="mb-3 flex w-full items-center justify-center gap-2 rounded-[20px] border border-line py-3 text-sm text-danger disabled:opacity-60">
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Delete all {mine.length} dishes you added
        </button>
      )}
      {!(!isDemo && (typicalOnly || meals.length === 0)) && (
        <AddDishes restaurantId={restaurantId} restaurantName={restaurantName} website={website} isDemo={isDemo} aiEnabled={aiEnabled} startOpen={false} onAdded={onChanged} />
      )}
      {open && <MealSheet meal={open} onClose={() => { setOpen(null); onChanged(); }} isFavorite={favoriteIds.includes(open.id)} />}
    </>
  );
}

type Mode = "closed" | "ai" | "paste" | "single";

function AddDishes({ restaurantId, restaurantName, website, isDemo, aiEnabled, startOpen, onAdded }: { restaurantId: string; restaurantName: string; website: string | null; isDemo: boolean; aiEnabled: boolean; startOpen: boolean; onAdded: () => void }) {
  const [mode, setMode] = useState<Mode>(startOpen ? (aiEnabled ? "ai" : "paste") : "closed");
  if (mode === "closed") {
    return (
      <button onClick={() => setMode(aiEnabled ? "ai" : "paste")} className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-line py-4 text-sm text-ink-2 hover:text-ink">
        <Plus size={16} />Add more dishes from their menu
      </button>
    );
  }
  const tab = (id: Mode, label: string) => (
    <button role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium sm:text-sm ${mode === id ? "bg-surface shadow-sm" : "text-ink-2"}`}>{label}</button>
  );
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Get their real menu</h3>
        <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist">{tab("ai", "Find with AI")}{tab("paste", "Paste")}{tab("single", "One dish")}</div>
      </div>
      {mode === "ai" ? (
        <FindWithAi restaurantId={restaurantId} aiEnabled={aiEnabled} onAdded={onAdded} />
      ) : (
        <>
          {!isDemo && <DeliveryLinks name={restaurantName} website={website} />}
          {mode === "paste" ? <PasteMenu restaurantId={restaurantId} onAdded={onAdded} /> : <AddDish restaurantId={restaurantId} onAdded={onAdded} />}
        </>
      )}
      <p className="text-[11px] text-ink-3">Added dishes are labelled with where they came from. Nutrition is estimated from the dish text; the numbers come from Matvaretabellen.</p>
    </section>
  );
}

/** Links out to the restaurant on delivery apps / its site, where the user can read and copy the real menu. */
function DeliveryLinks({ name, website }: { name: string; website: string | null }) {
  const q = encodeURIComponent(name);
  const link = "inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <span>Open their menu:</span>
      <a className={link} href={`https://wolt.com/en/search?q=${q}`} target="_blank" rel="noreferrer">Wolt <ExternalLink size={11} /></a>
      <a className={link} href={`https://www.google.com/search?q=${encodeURIComponent(`site:foodora.no "${name}"`)}`} target="_blank" rel="noreferrer">foodora <ExternalLink size={11} /></a>
      <a className={link} href={website ?? `https://www.google.com/search?q=${encodeURIComponent(`"${name}" meny`)}`} target="_blank" rel="noreferrer">{website ? "Their website" : "Search the web"} <ExternalLink size={11} /></a>
    </div>
  );
}

function FindWithAi({ restaurantId, aiEnabled, onAdded }: { restaurantId: string; aiEnabled: boolean; onAdded: () => void }) {
  const [state, setState] = useState<"idle" | "searching" | "done">("idle");
  const [result, setResult] = useState<FoundMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!aiEnabled) {
    return (
      <div className="space-y-2 text-sm text-ink-2">
        <p>AI can search the web — the restaurant’s website, Wolt, foodora, reviews — for their current menu and show you where it found each dish.</p>
        {backend.mode === "static" ? (
          <p>
            It needs a free Google Gemini key (takes about a minute to get).{" "}
            <Link href="/profile" className="font-medium text-ink underline underline-offset-2">Add your key in Profile</Link>, then come back.
          </p>
        ) : (
          <p>The server needs a <code>GEMINI_API_KEY</code> to use this.</p>
        )}
      </div>
    );
  }

  const search = async () => {
    setState("searching");
    setError(null);
    setMsg(null);
    try {
      setResult(await track(backend.findMenu(restaurantId)));
    } catch (e) {
      setError((e as Error).message || "The search failed.");
    } finally {
      setState("done");
    }
  };

  if (result?.dishes.length) {
    const source = result.sources[0];
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
          <p className="mb-1 font-medium text-ink">Found online — check it matches before adding:</p>
          <ul className="space-y-0.5">
            {result.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline"><Globe size={11} />{s.title}</a></li>
            ))}
          </ul>
          {result.note && <p className="mt-1 text-ink-3">{result.note}</p>}
        </div>
        <DishReview
          dishes={result.dishes}
          onBack={() => setResult(null)}
          onImport={(chosen) => backend.addDishes(restaurantId, chosen.map((d) => ({ ...d, category: "Found online by AI", sourceUrl: source?.url ?? null })))}
          onDone={(n) => {
            setResult(null);
            setMsg(`Added ${n} dishes. Open one to see its estimate.`);
            onAdded();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-2">Searches the web for this restaurant’s current menu. Only dishes found in real sources are shown, with links, and you choose what to add.</p>
      <button onClick={search} disabled={state === "searching"} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {state === "searching" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {state === "searching" ? "Searching the web… (up to a minute)" : "Find their menu online"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      {state === "done" && !error && result && !result.dishes.length && <p className="text-xs text-ink-2">{result.note ?? "No menu found online."} Try pasting it from Wolt or foodora instead.</p>}
      {msg && <p className="text-xs text-ink-2" role="status">{msg}</p>}
    </div>
  );
}

function DishReview({ dishes: initial, onBack, onImport, onDone }: { dishes: ParsedDish[]; onBack: () => void; onImport: (chosen: ParsedDish[]) => Promise<number>; onDone: (n: number) => void }) {
  const [dishes, setDishes] = useState(initial.map((d) => ({ ...d, on: true })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = dishes.filter((d) => d.on);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await track(onImport(chosen.map(({ name, description, priceNok }) => ({ name, description, priceNok })))));
    } catch (e) {
      setError((e as Error).message || "Couldn't add the dishes.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-2">{dishes.length} dishes — untick anything that isn’t a dish.</p>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {dishes.map((d, i) => (
          <li key={d.name}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2">
              <input type="checkbox" checked={d.on} onChange={() => setDishes(dishes.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="mt-1 accent-[var(--ink)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{d.name}</span>
                {d.description && <span className="block truncate text-xs text-ink-2">{d.description}</span>}
              </span>
              {d.priceNok != null && <span className="tabular text-xs text-ink-2">{fmtNok(d.priceNok)}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button onClick={onBack} className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm">Back</button>
        <button onClick={go} disabled={busy || !chosen.length} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />}Add {chosen.length} dishes
        </button>
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

function PasteMenu({ restaurantId, onAdded }: { restaurantId: string; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [dishes, setDishes] = useState<ParsedDish[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const parse = () => {
    const found = parseMenuText(text);
    setDishes(found.length ? found : null);
    setMsg(found.length ? null : "No dishes found. Paste the part of the menu with dish names (and prices if possible).");
  };

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-0.5 pl-4 text-xs text-ink-2">
        <li>Open their menu on Wolt, foodora or their website (links above).</li>
        <li>Select the menu text (dish names, descriptions, prices) and copy it.</li>
        <li>Paste it below — you can review every dish before it’s added.</li>
      </ol>
      {!dishes ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={"Chicken kebab wrap\nGrilled chicken, salad, garlic sauce\nkr 159,00\n…"} className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 font-mono text-xs outline-none focus:border-ink-3" aria-label="Pasted menu text" />
          <button onClick={parse} disabled={text.trim().length < 3} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
            <ClipboardPaste size={16} />Find dishes
          </button>
        </>
      ) : (
        <DishReview
          dishes={dishes}
          onBack={() => setDishes(null)}
          onImport={(chosen) => backend.addDishes(restaurantId, chosen.map((d): NewDish => ({ ...d, category: "Added from a pasted menu" })))}
          onDone={(n) => {
            setDishes(null);
            setText("");
            setMsg(`Added ${n} dish${n === 1 ? "" : "es"}. Open one to see its estimate.`);
            onAdded();
          }}
        />
      )}
      {msg && <p className="text-xs text-ink-2" role="status">{msg}</p>}
    </div>
  );
}

function AddDish({ restaurantId, onAdded }: { restaurantId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await track(backend.addDish(restaurantId, { name, description: desc || undefined, priceNok: price ? Number(price) : null }));
      setName("");
      setDesc("");
      setPrice("");
      onAdded();
    } catch (err) {
      setError((err as Error).message || "Couldn't add the dish.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-ink-2">Copy the name and description exactly as written on their menu — the description makes the estimate much better.</p>
      <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dish name, e.g. Chicken shawarma plate" className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-ink-3" />
      <textarea maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description / ingredients as written on the menu (optional, improves accuracy)" rows={2} className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-ink-3" />
      <div className="flex gap-2">
        <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="Price (kr)" className="w-28 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-ink-3" />
        <button disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {busy && <Loader2 size={15} className="animate-spin" />}Add &amp; estimate
        </button>
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
