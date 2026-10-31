"use client";
import { useState, useTransition } from "react";
import { Check, Database, Download, KeyRound, Loader2, LogOut, Mail, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { backend } from "@/lib/client/backend";
import { useHalal } from "@/lib/client/prefs";
import { presetTargets, type GoalType } from "@/lib/scoring";
import { fmtDate } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

interface ProfileData { goalType: GoalType; kcalTarget: number; proteinG: number; carbsG: number; fatG: number; weightKg: number | null; showDemo: boolean }

const GOALS: { id: GoalType; label: string; hint: string }[] = [
  { id: "cut", label: "Cutting", hint: "Calorie deficit, high protein to keep muscle and stay full" },
  { id: "bulk", label: "Bulking", hint: "Calorie surplus with substantial protein" },
  { id: "maintain", label: "Maintenance", hint: "Hold your weight" },
  { id: "healthy", label: "Healthy eating", hint: "Balanced meals, more fiber, fewer extremes" },
  { id: "custom", label: "Custom", hint: "Set your own targets" },
];

export function ProfileView({ profile, account, system, onChanged }: { profile: ProfileData; account: { kind: string; email: string | null; supabase: boolean }; system: { ai: string | null; places: string; foods: string[]; foodsRetrievedAt: string }; onChanged: () => Promise<void> }) {
  const [g, setG] = useState(profile);
  const [maintenance, setMaintenance] = useState(2400);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const { halalOnly, setHalalOnly } = useHalal();

  const field = (k: "kcalTarget" | "proteinG" | "carbsG" | "fatG", label: string, unit: string) => (
    <label className="block">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-line bg-bg focus-within:border-ink-3">
        <input type="number" inputMode="numeric" value={Math.round(g[k])} onChange={(e) => { setSaved(false); setG({ ...g, [k]: Number(e.target.value), goalType: g.goalType }); }} className="tabular w-full bg-transparent px-3 py-2.5 text-sm outline-none" />
        <span className="pr-3 text-xs text-ink-3">{unit}</span>
      </div>
    </label>
  );

  const applyPreset = (goalType: GoalType) => {
    setSaved(false);
    if (goalType === "custom") return setG({ ...g, goalType });
    setG({ ...g, ...presetTargets(goalType, Math.min(6000, Math.max(1200, maintenance)), g.weightKg), goalType });
  };

  const macroKcal = g.proteinG * 4 + g.carbsG * 4 + g.fatG * 9;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Profile</p>
        <h1 className="text-xl font-semibold tracking-tight">Goals &amp; settings</h1>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Your goal</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((x) => (
            <button key={x.id} onClick={() => applyPreset(x.id)} aria-pressed={g.goalType === x.id} className={`rounded-2xl border p-3 text-left transition ${g.goalType === x.id ? "border-ink bg-surface-2" : "border-line"}`}>
              <p className="text-sm font-semibold">{x.label}</p>
              <p className="text-xs text-ink-2">{x.hint}</p>
            </button>
          ))}
        </div>
        {g.goalType !== "custom" && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-2">Maintenance calories</span>
              <input type="number" value={maintenance} onChange={(e) => setMaintenance(Number(e.target.value))} onBlur={() => applyPreset(g.goalType)} className="tabular mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-2">Body weight (optional)</span>
              <input type="number" value={g.weightKg ?? ""} placeholder="kg" onChange={(e) => setG({ ...g, weightKg: e.target.value ? Number(e.target.value) : null })} onBlur={() => applyPreset(g.goalType)} className="tabular mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
            </label>
            <p className="col-span-2 text-[11px] text-ink-3">Presets suggest a starting point (cut −20%, bulk +10%, protein 1.6–2.0 g/kg). Adjust freely — this isn’t medical advice.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {field("kcalTarget", "Daily calories", "kcal")}
          {field("proteinG", "Protein", "g")}
          {field("carbsG", "Carbohydrates", "g")}
          {field("fatG", "Fat", "g")}
        </div>
        {Math.abs(macroKcal - g.kcalTarget) > g.kcalTarget * 0.08 && (
          <p className="text-xs text-warn">Your macros add up to {Math.round(macroKcal)} kcal, which differs from your calorie target.</p>
        )}
        <button
          disabled={pending}
          onClick={() => start(async () => { await backend.saveGoals(g); setSaved(true); })}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
          {saved ? "Saved" : "Save goals"}
        </button>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Display</h2>
        <ThemeToggle />
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Halal only</span>
            <span className="block text-xs text-ink-2">Show only restaurants tagged halal or likely halal (kebab, Turkish, Middle Eastern…), and hide dishes with pork. “Likely” isn’t confirmed — always ask the restaurant.</span>
          </span>
          <input type="checkbox" checked={halalOnly} onChange={(e) => setHalalOnly(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
        </label>
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Show demo restaurants</span>
            <span className="block text-xs text-ink-2">Fictional Oslo restaurants with illustrative menus, to try the full experience. Always labelled “Demo”.</span>
          </span>
          <input type="checkbox" checked={g.showDemo} onChange={(e) => { setG({ ...g, showDemo: e.target.checked }); start(() => backend.setShowDemo(e.target.checked)); }} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Mail size={16} />Account</h2>
        {account.kind === "supabase" ? (
          <div className="flex items-center justify-between text-sm">
            <span>Signed in as {account.email}</span>
            <button onClick={() => start(async () => { await backend.signOut(); await onChanged(); })} className="inline-flex items-center gap-1 text-ink-2"><LogOut size={14} />Sign out</button>
          </div>
        ) : account.supabase ? (
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await backend.signIn(email); setAuthMsg(r.ok ? "Check your email for a sign-in link." : r.error ?? "Sign-in failed"); }); }} className="space-y-2">
            <p className="text-xs text-ink-2">Sign in to sync your diary across devices.</p>
            <div className="flex gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm" />
              <button className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Send link</button>
            </div>
            {authMsg && <p className="text-xs text-ink-2">{authMsg}</p>}
          </form>
        ) : backend.mode === "static" ? (
          <p className="text-sm text-ink-2">This is the browser-only version: your goals, diary and saved items are stored in this browser only. Use Export to back them up.</p>
        ) : (
          <p className="text-sm text-ink-2">You’re using MacroMap without an account. Your diary is stored on this server under an anonymous browser ID.</p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} />Privacy &amp; your data</h2>
        <p className="text-xs text-ink-2">We store only your goals, diary and saved items. Your location is used only to look up nearby places on OpenStreetMap and is never saved with your data. AI estimation sends only menu text — never your personal data.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => start(downloadExport)} className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm"><Download size={15} />Export my data</button>
          <button
            onClick={() => { if (confirm("Delete your goals, diary and saved items? This can’t be undone.")) start(async () => { await backend.deleteMyData(); await onChanged(); }); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm text-danger"
          >
            <Trash2 size={15} />Delete my data
          </button>
        </div>
      </section>

      {backend.aiKey && <AiKeyCard onSaved={onChanged} />}

      <section className="card space-y-2 p-5 text-xs text-ink-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Database size={16} />Data sources &amp; how numbers are made</h2>
        <ul className="list-disc space-y-1 pl-4">
          {system.foods.map((f) => <li key={f}>{f}</li>)}
          <li>Restaurants: {system.places}</li>
          <li className="flex-inline"><Sparkles size={11} className="mr-1 inline" />AI ingredient analysis: {system.ai ?? "not configured (template estimates only)"}</li>
        </ul>
        <p>Food-composition data retrieved {fmtDate(system.foodsRetrievedAt)}. Verified values come only from restaurants. Estimates are computed from ingredients and portion ranges and always shown as ranges; AI never produces nutrient numbers itself. We don’t claim a fixed accuracy — see the validation plan in the project docs.</p>
      </section>
    </div>
  );
}

async function downloadExport() {
  const data = await backend.exportData();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "macromap-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** Static (GitHub Pages) build only: the user's own free Gemini key, kept in this browser. */
function AiKeyCard({ onSaved }: { onSaved: () => Promise<void> }) {
  const [key, setKey] = useState(() => backend.aiKey?.get() ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><KeyRound size={16} />AI estimates (optional)</h2>
      <p className="text-xs text-ink-2">
        Paste a free Google Gemini key from{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/apikey</a>{" "}
        to analyse any dish. The key is stored only in this browser and sent only to Google, along with the dish’s menu text.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          backend.aiKey?.set(key);
          setSaved(true);
          await onSaved();
        }}
        className="flex gap-2"
      >
        <input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} placeholder="Gemini API key" className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm" />
        <button className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">{saved ? "Saved" : "Save"}</button>
      </form>
    </section>
  );
}
