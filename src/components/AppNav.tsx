"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, Compass, NotebookPen, Search, UserRound } from "lucide-react";

const TABS = [
  { href: "/", label: "Explore", Icon: Compass },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/diary", label: "Diary", Icon: NotebookPen },
  { href: "/saved", label: "Saved", Icon: BookHeart },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

export function AppNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/r/") : path.startsWith(href));
  return (
    <>
      {/* Mobile tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-md md:hidden" aria-label="Primary">
        <ul className="mx-auto flex max-w-lg justify-around px-2 pt-1.5">
          {TABS.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className={`flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${active(href) ? "text-ink" : "text-ink-3"}`} aria-current={active(href) ? "page" : undefined}>
                <Icon size={22} strokeWidth={active(href) ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop rail */}
      <nav className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 md:flex" aria-label="Primary">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-sm font-bold text-bg">M</span>
          MacroMap
        </Link>
        <ul className="space-y-1">
          {TABS.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active(href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60"}`} aria-current={active(href) ? "page" : undefined}>
                <Icon size={19} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-ink-3">
          Nutrition from Matvaretabellen &amp; USDA FoodData Central. Places © OpenStreetMap contributors.
        </p>
      </nav>
    </>
  );
}
