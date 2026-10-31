import { detectArchetype, genericOptions, getArchetype } from "./archetypes";
import type { FoodKey } from "./catalog";
import { customize, type OptionGroup, type Selections } from "./customize";
import { estimateFromComponents, estimateFromOfficial } from "./estimate";
import type { Component, EstimateProvider, NutritionEstimate, OfficialNutrition } from "./types";

/**
 * Everything needed to (re)compute a menu item's nutrition on server or client.
 * Stored as JSON on nutrition_records so estimates are reproducible.
 */
export type EstimateBasis =
  | { kind: "official"; official: OfficialNutrition }
  | {
      kind: "archetype";
      archetypeId: string;
      /** Inferred choices — they shape the recipe but keep the uncertainty. */
      defaults: Selections;
      /** Facts stated on the menu (e.g. "8 pcs") — treated as answered. */
      known: Selections;
      extras: Component[];
      provider: EstimateProvider;
      assumptions: string[];
      mainUncertainty?: string | null;
    }
  | {
      kind: "components";
      components: Component[];
      provider: EstimateProvider;
      assumptions: string[];
      mainUncertainty: string | null;
      referenceKey?: FoodKey | null;
    }
  | { kind: "unavailable"; reason: string };

export interface ResolvedEstimate {
  estimate: NutritionEstimate | null;
  options: OptionGroup[];
  /** Effective selections (defaults + known + user), for rendering controls. */
  selections: Selections;
  unknowns: string[];
  reason?: string;
}

export function resolveBasis(basis: EstimateBasis, user: Selections = {}): ResolvedEstimate {
  switch (basis.kind) {
    case "official":
      return { estimate: estimateFromOfficial(basis.official), options: [], selections: {}, unknowns: [] };
    case "unavailable":
      return { estimate: null, options: [], selections: {}, unknowns: [], reason: basis.reason };
    case "archetype": {
      const a = getArchetype(basis.archetypeId);
      if (!a) return { estimate: null, options: [], selections: {}, unknowns: [], reason: "Unknown dish type" };
      const explicit = { ...basis.known, ...user };
      const { components, unknowns } = customize([...a.base, ...basis.extras], a.options, basis.defaults, explicit);
      const estimate = estimateFromComponents({
        components,
        provider: basis.provider,
        assumptions: [...a.assumptions, ...basis.assumptions],
        mainUncertainty: unknowns.length ? basis.mainUncertainty ?? a.mainUncertainty : null,
        referenceKey: a.referenceKey,
      });
      return { estimate, options: a.options, selections: { ...basis.defaults, ...explicit }, unknowns };
    }
    case "components": {
      const options = genericOptions(basis.components);
      const { components, unknowns } = customize(basis.components, options, {}, user);
      const estimate = estimateFromComponents({
        components,
        provider: basis.provider,
        assumptions: basis.assumptions,
        mainUncertainty: basis.mainUncertainty,
        referenceKey: basis.referenceKey ?? null,
      });
      return { estimate, options, selections: user, unknowns };
    }
  }
}

/**
 * Rule-based estimator: recognises a dish archetype from the menu text and infers
 * choices from keywords. Used when no AI provider is configured or the AI fails.
 */
export function templateBasis(name: string, description = "", provider: EstimateProvider = "template"): EstimateBasis {
  const text = `${name} ${description}`.toLowerCase();
  const a = detectArchetype(name, description);
  if (!a) {
    return {
      kind: "unavailable",
      reason: "We don't recognise this dish well enough to estimate it without AI. Add a description or enable an AI provider.",
    };
  }
  // Categorical choices named on the menu ("chicken", "tuna") are facts; inferred
  // quantities ("large") still leave the portion uncertain.
  const inferred = a.infer?.(text, name.toLowerCase()) ?? {};
  const defaults: Selections = {};
  const known: Selections = knownFromText(a.id, text);
  for (const [id, v] of Object.entries(inferred)) {
    const group = a.options.find((o) => o.id === id);
    if (group && !group.narrows && group.kind === "single") known[id] = v;
    else defaults[id] = v;
  }
  return {
    kind: "archetype",
    archetypeId: a.id,
    defaults,
    known,
    extras: [],
    provider,
    assumptions: provider === "template" ? [`Matched to the "${a.label}" template from the menu text.`] : [],
  };
}

function knownFromText(archetypeId: string, text: string): Selections {
  if (archetypeId === "sushi_nigiri" || archetypeId === "sushi_maki") {
    const m = text.match(/(\d{1,2})\s*(?:pcs|pieces|piece|stk|biter|bitar|pc)\b/);
    if (m) return { pieces: Number(m[1]) };
  }
  return {};
}
