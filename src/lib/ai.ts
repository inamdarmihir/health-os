import type { HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate } from "./health-types";
import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, MealPlan, WalkSpot } from "./food-types";
import type { CoachChatMessage, CoachState, CoachTurnResult } from "./coach-types";
import {
  analyzeHealthWithGemini,
  getGeminiApiKey,
  planMealsWithGemini,
  resolveTextModel,
  runCoachTurn as runCoachTurnWithGemini,
} from "./gemini";

export function activeProvider() {
  return "gemini" as const;
}

export function resolveIntelligenceModel() {
  return resolveTextModel();
}

export function intelligenceConfigured() {
  return Boolean(getGeminiApiKey());
}

export function analyzeHealth(
  profile: HealthProfile,
  images: ImageInput[],
  metrics: LocalMetricEstimate,
): Promise<HealthOsReport> {
  return analyzeHealthWithGemini(profile, images, metrics);
}

export function runCoachTurn(
  state: CoachState,
  messages: CoachChatMessage[],
): Promise<CoachTurnResult> {
  return runCoachTurnWithGemini(state, messages);
}

export function planMeals(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string,
): Promise<Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">> {
  return planMealsWithGemini(profile, joints, walkSpots, recentLog, searchHits, targetDate);
}
