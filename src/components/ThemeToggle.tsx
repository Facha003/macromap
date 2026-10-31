"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("mm.theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const apply = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("mm.theme");
      else localStorage.setItem("mm.theme", t);
    } catch {}
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  const opts: { id: Theme; label: string; Icon: typeof Sun }[] = [
    { id: "system", label: "System", Icon: Monitor },
    { id: "light", label: "Light", Icon: Sun },
    { id: "dark", label: "Dark", Icon: Moon },
  ];
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
      {opts.map(({ id, label, Icon }) => (
        <button key={id} role="radio" aria-checked={theme === id} onClick={() => apply(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${theme === id ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}>
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}
