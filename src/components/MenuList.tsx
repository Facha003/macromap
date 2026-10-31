"use client";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { track } from "@/lib/client/loading";
import { backend } from "@/lib/client/backend";
import type { MealView } from "@/server/repo/menu";
import { MealRow } from "./MealRow";
import { MealSheet } from "./MealSheet";

export function MenuList({ meals, favoriteIds, restaurantId, aiEnabled, onChanged }: { meals: MealView[]; favoriteIds: string[]; restaurantId: string; aiEnabled: boolean; onChanged: () => void }) {
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
      <AddDish restaurantId={restaurantId} aiEnabled={aiEnabled} hasMenu={meals.length > 0} onAdded={onChanged} />
      {open && <MealSheet meal={open} onClose={() => { setOpen(null); onChanged(); }} isFavorite={favoriteIds.includes(open.id)} />}
    </>
  );
}

function AddDish({ restaurantId, aiEnabled, hasMenu, onAdded }: { restaurantId: string; aiEnabled: boolean; hasMenu: boolean; onAdded: () => void }) {
  const [expanded, setExpanded] = useState(!hasMenu);
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
      setExpanded(false);
      onAdded();
    } catch (err) {
      setError((err as Error).message || "Couldn't add the dish.");
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-line py-4 text-sm text-ink-2 hover:text-ink">
        <Plus size={16} />Add a dish from their menu
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <h3 className="font-semibold">Add a dish you can see on their menu</h3>
        <p className="mt-0.5 text-xs text-ink-2">
          Copy the name and description from the restaurant’s own menu. {aiEnabled ? "AI interprets the ingredients; nutrients are computed from Matvaretabellen." : "It’s matched to a dish template; enable an AI provider for any dish."} It’s labelled as user-added.
        </p>
      </div>
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
