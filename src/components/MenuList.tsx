"use client";
import { useState } from "react";
import { ClipboardPaste, ExternalLink, Loader2, Plus } from "lucide-react";
import { parseMenuText, type ParsedDish } from "@/lib/menuParse";
import { fmtNok } from "@/lib/format";
import { track } from "@/lib/client/loading";
import { backend } from "@/lib/client/backend";
import type { MealView } from "@/server/repo/menu";
import { MealRow } from "./MealRow";
import { MealSheet } from "./MealSheet";

export function MenuList({ meals, favoriteIds, restaurantId, restaurantName, isDemo, aiEnabled, onChanged }: { meals: MealView[]; favoriteIds: string[]; restaurantId: string; restaurantName: string; isDemo: boolean; aiEnabled: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<MealView | null>(null);
  const groups = meals.reduce<Record<string, MealView[]>>((acc, m) => {
    (acc[m.category ?? "Menu"] ??= []).push(m);
    return acc;
  }, {});
  return (
    <>
      {Object.entries(groups).map(([cat, items]) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{cat}</h2>
          <ul className="space-y-2">
            {items.map((m) => (
              <li key={m.id}><MealRow meal={m} onOpen={() => setOpen(m)} /></li>
            ))}
          </ul>
        </section>
      ))}
      <AddDishes restaurantId={restaurantId} restaurantName={restaurantName} isDemo={isDemo} aiEnabled={aiEnabled} hasMenu={meals.length > 0} onAdded={onChanged} />
      {open && <MealSheet meal={open} onClose={() => { setOpen(null); onChanged(); }} isFavorite={favoriteIds.includes(open.id)} />}
    </>
  );
}

function AddDishes({ restaurantId, restaurantName, isDemo, aiEnabled, hasMenu, onAdded }: { restaurantId: string; restaurantName: string; isDemo: boolean; aiEnabled: boolean; hasMenu: boolean; onAdded: () => void }) {
  const [mode, setMode] = useState<"closed" | "paste" | "single">(hasMenu ? "closed" : "paste");
  if (mode === "closed") {
    return (
      <button onClick={() => setMode("paste")} className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-line py-4 text-sm text-ink-2 hover:text-ink">
        <Plus size={16} />Add dishes from their menu
      </button>
    );
  }
  const tab = (id: "paste" | "single", label: string) => (
    <button role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-1.5 text-sm ${mode === id ? "bg-surface shadow-sm" : "text-ink-2"}`}>{label}</button>
  );
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Add dishes</h3>
        <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist">{tab("paste", "Paste a menu")}{tab("single", "One dish")}</div>
      </div>
      {!isDemo && <DeliveryLinks name={restaurantName} />}
      {mode === "paste" ? <PasteMenu restaurantId={restaurantId} onAdded={onAdded} /> : <AddDish restaurantId={restaurantId} onAdded={onAdded} />}
      <p className="text-[11px] text-ink-3">Dishes you add are labelled “Added by a user”. Nutrition is estimated from the text — {aiEnabled ? "AI reads the ingredients and" : "a dish template is matched and"} the numbers come from Matvaretabellen.</p>
    </section>
  );
}

/** Links out to the restaurant on delivery apps, where the user can read and copy the real menu. */
function DeliveryLinks({ name }: { name: string }) {
  const q = encodeURIComponent(name);
  const link = "inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <span>Find their menu:</span>
      <a className={link} href={`https://wolt.com/en/search?q=${q}`} target="_blank" rel="noreferrer">Wolt <ExternalLink size={11} /></a>
      <a className={link} href={`https://www.google.com/search?q=${encodeURIComponent(`site:foodora.no "${name}"`)}`} target="_blank" rel="noreferrer">foodora <ExternalLink size={11} /></a>
      <a className={link} href={`https://www.google.com/search?q=${encodeURIComponent(`"${name}" meny`)}`} target="_blank" rel="noreferrer">Their website <ExternalLink size={11} /></a>
    </div>
  );
}

function PasteMenu({ restaurantId, onAdded }: { restaurantId: string; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [dishes, setDishes] = useState<(ParsedDish & { on: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const parse = () => {
    const found = parseMenuText(text);
    setDishes(found.map((d) => ({ ...d, on: true })));
    setMsg(found.length ? null : "No dishes found. Paste the part of the menu with dish names (and prices if possible).");
  };

  const importAll = async () => {
    const chosen = (dishes ?? []).filter((d) => d.on);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const n = await track(backend.addDishes(restaurantId, chosen.map(({ name, description, priceNok }) => ({ name, description, priceNok }))));
      setMsg(`Added ${n} dish${n === 1 ? "" : "es"}. Open one to see its estimate.`);
      setDishes(null);
      setText("");
      onAdded();
    } catch (e) {
      setMsg((e as Error).message || "Couldn't import the menu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-0.5 pl-4 text-xs text-ink-2">
        <li>Open their menu on Wolt, foodora or their website.</li>
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
        <>
          <p className="text-xs text-ink-2">Found {dishes.length} dishes — untick anything that isn’t a dish.</p>
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
            <button onClick={() => setDishes(null)} className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm">Back</button>
            <button onClick={importAll} disabled={busy || !dishes.some((d) => d.on)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {busy && <Loader2 size={15} className="animate-spin" />}Add {dishes.filter((d) => d.on).length} dishes
            </button>
          </div>
        </>
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
