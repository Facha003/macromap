/**
 * Guards async UI work so only the most recent request may update state:
 *   const guard = createLatestGuard();
 *   const token = guard.next();  …await…  if (!guard.isLatest(token)) return;
 */
export function createLatestGuard() {
  let current = 0;
  return {
    next: () => ++current,
    isLatest: (token: number) => token === current,
  };
}
