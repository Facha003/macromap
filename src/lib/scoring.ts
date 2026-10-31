import type { DataStatus, NutritionValues } from "./nutrition/types";
import { proteinPer100kcal, rangeWidth } from "./nutrition/estimate";

export type GoalType = "cut" | "bulk" | "maintain" | "healthy" | "custom";

export interface Goals {
  goalType: GoalType;
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealForScoring {
  values: NutritionValues;
  status: DataStatus;
  distanceM: number | null;
}

export interface Score {
  score: number; // 0–100
  reasons: string[];
}

interface Weights { kcal: number; density: number; protein: number; fiber: number; reliability: number; distance: number }

const WEIGHTS: Record<GoalType, Weights> = {
  cut: { kcal: 0.3, density: 0.25, protein: 0.15, fiber: 0.05, reliability: 0.1, distance: 0.15 },
  bulk: { kcal: 0.3, density: 0.05, protein: 0.3, fiber: 0, reliability: 0.1, distance: 0.15 },
  maintain: { kcal: 0.25, density: 0.15, protein: 0.2, fiber: 0.05, reliability: 0.15, distance: 0.2 },
  healthy: { kcal: 0.2, density: 0.15, protein: 0.15, fiber: 0.15, reliability: 0.15, distance: 0.2 },
  custom: { kcal: 0.25, density: 0.15, protein: 0.2, fiber: 0.05, reliability: 0.15, distance: 0.2 },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Size of a sensible single meal given the goal and what's left today. */
export function mealBudget(goals: Goals, consumed: Totals): { kcal: number; protein: number } {
  const remaining = Math.max(0, goals.kcalTarget - consumed.kcal);
  const share = goals.goalType === "bulk" ? 0.4 : 0.35;
  const typical = goals.kcalTarget * share;
  const kcal = remaining > 0 ? Math.min(remaining, typical * 1.15) : typical * 0.3;
  const proteinLeft = Math.max(0, goals.proteinG - consumed.protein);
  return { kcal, protein: Math.max(goals.proteinG * 0.25, Math.min(proteinLeft, goals.proteinG * 0.45)) };
}

export function scoreMeal(meal: MealForScoring, goals: Goals, consumed: Totals): Score {
  const w = WEIGHTS[goals.goalType];
  const budget = mealBudget(goals, consumed);
  const kcal = meal.values.kcal.likely;
  const protein = meal.values.protein.likely;
  const reasons: string[] = [];

  // Calorie fit. Cutting/maintaining: being over budget is penalised steeply, a very
  // small meal mildly (it is unlikely to satisfy). Bulking: falling short is penalised.
  let kcalFit: number;
  if (goals.goalType === "bulk") {
    kcalFit = kcal >= budget.kcal * 0.8 ? 1 - clamp01((kcal - budget.kcal * 1.6) / budget.kcal) : kcal / (budget.kcal * 0.8);
  } else if (kcal <= budget.kcal) {
    kcalFit = 1 - 0.4 * clamp01((budget.kcal * 0.45 - kcal) / (budget.kcal * 0.45));
  } else {
    kcalFit = Math.exp(-((kcal - budget.kcal) / budget.kcal) / 0.2);
  }
  if (kcal <= budget.kcal && goals.goalType !== "bulk") reasons.push(`Fits a ${Math.round(budget.kcal / 10) * 10} kcal meal budget`);
  if (goals.goalType === "bulk" && kcal >= budget.kcal * 0.8) reasons.push("Substantial calories for a surplus");

  const density = proteinPer100kcal(meal.values);
  const densityFit = clamp01(density / 10);
  if (density >= 7) reasons.push(`${density.toFixed(1)} g protein per 100 kcal`);

  const proteinFit = clamp01(protein / budget.protein);
  if (protein >= budget.protein * 0.9) reasons.push(`${Math.round(protein)} g protein`);

  const fiber = meal.values.fiber?.likely ?? 0;
  const fiberFit = clamp01(fiber / 10);

  const base = meal.status === "verified" ? 1 : meal.status === "external" ? 0.85 : 0.72;
  const reliability = clamp01(base - Math.max(0, rangeWidth(meal.values.kcal) - 0.25) * 0.4);
  if (meal.status === "verified") reasons.push("Official nutrition data");

  const distanceFit = meal.distanceM == null ? 0.5 : 1 / (1 + meal.distanceM / 2000);

  const total =
    w.kcal * kcalFit + w.density * densityFit + w.protein * proteinFit + w.fiber * fiberFit + w.reliability * reliability + w.distance * distanceFit;

  return { score: Math.round(total * 100), reasons: reasons.slice(0, 3) };
}

export function presetTargets(goalType: GoalType, maintenanceKcal: number, weightKg?: number | null): Omit<Goals, "goalType"> {
  const kcal = Math.round(
    goalType === "cut" ? maintenanceKcal * 0.8 : goalType === "bulk" ? maintenanceKcal * 1.1 : maintenanceKcal,
  );
  const gPerKg = goalType === "cut" ? 2.0 : goalType === "bulk" ? 1.8 : 1.6;
  const protein = Math.round(weightKg ? weightKg * gPerKg : (kcal * (goalType === "cut" ? 0.3 : 0.25)) / 4);
  const fat = Math.round((kcal * (goalType === "bulk" ? 0.28 : 0.3)) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcalTarget: kcal, proteinG: protein, carbsG: carbs, fatG: fat };
}
