import type { FoodKey } from "./catalog";
import type { Component, Range, Role } from "./types";

export type Op =
  | { type: "scaleAll"; factor: number }
  | { type: "scaleRole"; role: Role; factor: number }
  | { type: "replaceRole"; role: Role; foodKey: FoodKey; gramsFactor?: number; extra?: Component[] }
  | { type: "add"; component: Component }
  | { type: "remove"; role: Role };

export interface OptionChoice {
  id: string;
  label: string;
  ops: Op[];
}

interface BaseGroup {
  id: string;
  label: string;
  /** What stays uncertain while the user hasn't answered this, e.g. "Sauce quantity". */
  unknownLabel?: string;
  /** Roles whose portion range tightens once the user answers explicitly. */
  narrows?: Role[] | "all";
}

export interface SingleGroup extends BaseGroup {
  kind: "single";
  choices: OptionChoice[];
  defaultChoice: string;
}

export interface MultiGroup extends BaseGroup {
  kind: "multi";
  choices: OptionChoice[];
  defaultChoices?: string[];
}

export interface CountGroup extends BaseGroup {
  kind: "count";
  min: number;
  max: number;
  defaultCount: number;
  unit: string;
}

export type OptionGroup = SingleGroup | MultiGroup | CountGroup;

export type Selections = Record<string, string | string[] | number>;

function scale(g: Range, f: number): Range {
  return { min: g.min * f, likely: g.likely * f, max: g.max * f };
}

function tighten(g: Range, keep = 0.5): Range {
  return {
    min: g.likely - (g.likely - g.min) * keep,
    likely: g.likely,
    max: g.likely + (g.max - g.likely) * keep,
  };
}

function applyOp(components: Component[], op: Op): Component[] {
  switch (op.type) {
    case "scaleAll":
      return components.map((c) => ({ ...c, grams: scale(c.grams, op.factor) }));
    case "scaleRole":
      return components.map((c) => (c.role === op.role ? { ...c, grams: scale(c.grams, op.factor) } : c));
    case "replaceRole": {
      const out: Component[] = [];
      let replaced = false;
      for (const c of components) {
        if (c.role !== op.role) { out.push(c); continue; }
        if (replaced) continue; // collapse multiple components of the role into the replacement
        replaced = true;
        out.push({ foodKey: op.foodKey, role: op.role, grams: scale(c.grams, op.gramsFactor ?? 1) });
      }
      return replaced ? [...out, ...(op.extra ?? [])] : out;
    }
    case "add":
      return [...components, op.component];
    case "remove":
      return components.filter((c) => c.role !== op.role);
  }
}

/** Resolves which choices are active for a group, falling back to its defaults. */
export function activeChoices(group: OptionGroup, selections: Selections): OptionChoice[] {
  if (group.kind === "single") {
    const id = typeof selections[group.id] === "string" ? (selections[group.id] as string) : group.defaultChoice;
    const c = group.choices.find((x) => x.id === id) ?? group.choices.find((x) => x.id === group.defaultChoice);
    return c ? [c] : [];
  }
  if (group.kind === "multi") {
    const ids = Array.isArray(selections[group.id]) ? (selections[group.id] as string[]) : group.defaultChoices ?? [];
    return group.choices.filter((c) => ids.includes(c.id));
  }
  return [];
}

export interface CustomizedRecipe {
  components: Component[];
  /** Uncertainty labels for questions the user hasn't answered. */
  unknowns: string[];
}

/**
 * Applies option groups to a base recipe. `explicit` holds selections the user
 * actually made; `defaults` are inferred (from menu text or by an estimator) and
 * change the recipe but do not reduce uncertainty.
 */
export function customize(
  base: Component[],
  groups: OptionGroup[],
  defaults: Selections,
  explicit: Selections,
): CustomizedRecipe {
  const merged = { ...defaults, ...explicit };
  let components = base.map((c) => ({ ...c, grams: { ...c.grams } }));
  const deferred: Op[] = [];
  const unknowns: string[] = [];

  for (const g of groups) {
    if (g.kind === "count") {
      const raw = merged[g.id];
      const n = typeof raw === "number" ? Math.min(g.max, Math.max(g.min, raw)) : g.defaultCount;
      deferred.push({ type: "scaleAll", factor: n / g.defaultCount });
    } else {
      for (const choice of activeChoices(g, merged)) {
        for (const op of choice.ops) {
          // Whole-portion scaling runs last so it also covers components added by later groups.
          if (op.type === "scaleAll") deferred.push(op);
          else components = applyOp(components, op);
        }
      }
    }

    const answered = g.id in explicit;
    if (answered && g.narrows) {
      components = components.map((c) =>
        g.narrows === "all" || g.narrows!.includes(c.role) ? { ...c, grams: tighten(c.grams) } : c,
      );
    }
    if (!answered && g.unknownLabel) unknowns.push(g.unknownLabel);
  }

  for (const op of deferred) components = applyOp(components, op);
  return { components, unknowns };
}
