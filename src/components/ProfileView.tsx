"use client";
import { useState, useTransition } from "react";
import { Check, Database, Download, Loader2, LogOut, Mail, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { deleteMyData, saveGoals, setShowDemo, signInWithEmail, signOut, suggestTargets } from "@/app/actions";
import type { GoalType } from "@/lib/scoring";
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

export function ProfileView({ profile, account, system }: { profile: ProfileData; account: { kind: string; email: string | null; supabase: boolean }; system: { ai: string | null; places: string; foods: string[]; foodsRetrievedAt: string } }) {
  const [g, setG] = useState(profile);
  const [maintenance, setMaintenance] = useState(2400);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);

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
    start(async () => {
      const t = await suggestTargets(goalType, maintenance, g.weightKg);
      setG({ ...g, ...t, goalType });
    });
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
          onClick={() => start(async () => { await saveGoals(g); setSaved(true); })}
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
            <span className="block text-sm font-medium">Show demo restaurants</span>
            <span className="block text-xs text-ink-2">Fictional Oslo restaurants with illustrative menus, to try the full experience. Always labelled “Demo”.</span>
          </span>
          <input type="checkbox" checked={g.showDemo} onChange={(e) => { setG({ ...g, showDemo: e.target.checked }); start(() => setShowDemo(e.target.checked)); }} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Mail size={16} />Account</h2>
        {account.kind === "supabase" ? (
          <div className="flex items-center justify-between text-sm">
            <span>Signed in as {account.email}</span>
            <button onClick={() => start(() => signOut())} className="inline-flex items-center gap-1 text-ink-2"><LogOut size={14} />Sign out</button>
          </div>
        ) : account.supabase ? (
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await signInWithEmail(email); setAuthMsg(r.ok ? "Check your email for a sign-in link." : r.error ?? "Sign-in failed"); }); }} className="space-y-2">
            <p className="text-xs text-ink-2">Sign in to sync your diary across devices.</p>
            <div className="flex gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm" />
              <button className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Send link</button>
            </div>
            {authMsg && <p className="text-xs text-ink-2">{authMsg}</p>}
          </form>
        ) : (
          <p className="text-sm text-ink-2">You’re using MacroMap without an account. Your diary is stored on this server under an anonymous browser ID.</p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} />Privacy &amp; your data</h2>
        <p className="text-xs text-ink-2">We store only your goals, diary and saved items. Location is used in your browser to search and isn’t stored on the server. AI estimation sends only menu text — never your personal data.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm"><Download size={15} />Export my data</a>
          <button
            onClick={() => { if (confirm("Delete your goals, diary and saved items? This can’t be undone.")) start(() => deleteMyData()); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm text-danger"
          >
            <Trash2 size={15} />Delete my data
          </button>
        </div>
      </section>

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
