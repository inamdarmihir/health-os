import type { HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate } from "./health-types";
import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, MealPlan, WalkSpot } from "./food-types";
import type { CoachChatMessage, CoachState, CoachTurnResult } from "./coach-types";
import { analyzeHealthWithGemini, getGeminiApiKey, planMealsWithGemini, resolveTextModel as resolveGeminiTextModel, runCoachTurn as runCoachTurnWithGemini } from "./gemini";
import { analyzeHealthWithOpenAi, getOpenAiApiKey, planMealsWithOpenAi, resolveOpenAiTextModel, runCoachTurn as runCoachTurnWithOpenAi } from "./openai";

export type AiProvider = "openai" | "gemini";

export function activeProvider(): AiProvider {
  const configured = (process.env.AI_PROVIDER || "").toLowerCase();
  if (configured === "openai" || configured === "gemini") return configured;
  return getOpenAiApiKey() ? "openai" : "gemini";
}

export function resolveIntelligenceModel() {
  return activeProvider() === "openai" ? resolveOpenAiTextModel() : resolveGeminiTextModel();
}

export function intelligenceConfigured() {
  return activeProvider() === "openai" ? Boolean(getOpenAiApiKey()) : Boolean(getGeminiApiKey());
}

export function analyzeHealth(profile: HealthProfile, images: ImageInput[], metrics: LocalMetricEstimate): Promise<HealthOsReport> {
  return activeProvider() === "openai"
    ? analyzeHealthWithOpenAi(profile, images, metrics)
    : analyzeHealthWithGemini(profile, images, metrics);
}

export function runCoachTurn(state: CoachState, messages: CoachChatMessage[]): Promise<CoachTurnResult> {
  return activeProvider() === "openai" ? runCoachTurnWithOpenAi(state, messages) : runCoachTurnWithGemini(state, messages);
}

export function planMeals(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string
): Promise<Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">> {
  return activeProvider() === "openai"
    ? planMealsWithOpenAi(profile, joints, walkSpots, recentLog, searchHits, targetDate)
    : planMealsWithGemini(profile, joints, walkSpots, recentLog, searchHits, targetDate);
}
