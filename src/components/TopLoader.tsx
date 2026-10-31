"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { startLoading, subscribeLoading } from "@/lib/client/loading";

/**
 * Thin progress bar at the top of the screen. It creeps toward 90% while work
 * is in flight (page navigation, data fetches, AI estimates), then completes.
 */
export function TopLoader() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const navStop = useRef<(() => void) | null>(null);
  const pathname = usePathname();
  const search = useSearchParams();

  // Start on same-origin link clicks; finish when the route actually changes.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      navStop.current?.();
      navStop.current = startLoading();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    navStop.current?.();
    navStop.current = null;
  }, [pathname, search]);

  useEffect(
    () =>
      subscribeLoading((n) => {
        clearInterval(timer.current);
        if (n > 0) {
          setVisible(true);
          setProgress((p) => (p >= 100 || p === 0 ? 8 : p));
          timer.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200);
        } else {
          setProgress((p) => (p === 0 ? 0 : 100));
          timer.current = setInterval(() => {
            setVisible(false);
            setProgress(0);
            clearInterval(timer.current);
          }, 350);
        }
      }),
    [],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="h-full rounded-r-full bg-brand shadow-[0_0_8px_var(--brand)]"
        style={{ width: `${progress}%`, transition: progress === 0 ? "none" : "width 200ms ease-out" }}
      />
    </div>
  );
}
