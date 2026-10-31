"use client";

/**
 * Global "something is loading" counter that drives the top loading bar.
 * Wrap any async work with `track(promise)`; nested/overlapping work is fine.
 */
let active = 0;
const listeners = new Set<(n: number) => void>();

function emit() {
  listeners.forEach((l) => l(active));
}

export function startLoading(): () => void {
  active++;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    active = Math.max(0, active - 1);
    emit();
  };
}

export function track<T>(p: Promise<T>): Promise<T> {
  const stop = startLoading();
  return p.finally(stop);
}

export function subscribeLoading(fn: (n: number) => void): () => void {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}
