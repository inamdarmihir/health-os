import type { HealthProfile } from "./health-types";
import type { FoodProfile, MealPlan, MealPlatform, MealType } from "./food-types";

export type CoachProfile = HealthProfile & FoodProfile;

export type CoachChatMessage = {
  role: "user" | "coach";
  content: string;
};

export type CoachMealLogDraft = {
  mealType: MealType;
  item: string;
  jointName?: string;
  costRs?: number;
  platform?: MealPlatform;
  notes?: string;
};

export type CoachJointDraft = {
  name: string;
  area: string;
  cuisine?: string;
  notes?: string;
};

export type CoachWalkSpotDraft = {
  name: string;
  area: string;
  notes?: string;
};

// ─── Inline recommendation cards ─────────────────────────────────────────────

/** A single exercise the model recommends given the conversation context. */
export type ExerciseSuggestion = {
  name: string;
  /** e.g. "3 sets × 12 reps" or "20 min" */
  sets: string;
  /** One-line reason tied to what the user said */
  reason: string;
  /** Search query the route should use to find a YouTube tutorial */
  searchQuery: string;
  /** Populated by the route after Exa search — never sent by the model */
  videoUrl?: string;
  videoTitle?: string;
};

/** A food outlet the model recommends. The route enriches with Exa evidence. */
export type FoodSpotSuggestion = {
  name: string;
  area: string;
  cuisine?: string;
  /** Why this fits the user's goal/preferences */
  reason: string;
  /** Populated by the route after Exa search */
  url?: string;
  snippet?: string;
};

/** A walk spot the model recommends given location and conversation context. */
export type WalkSpotSuggestion = {
  name: string;
  area: string;
  /** e.g. "evening, 20–30 min" */
  timing: string;
  reason: string;
};

// ─── Turn result ──────────────────────────────────────────────────────────────

export type CoachTurnResult = {
  reply: string;
  profileUpdates?: Partial<CoachProfile>;
  logMeal?: CoachMealLogDraft | null;
  saveJoint?: CoachJointDraft | null;
  saveWalkSpot?: CoachWalkSpotDraft | null;
  readyForMealPlan?: boolean;
  /** Proactive exercise recommendations for this turn */
  suggestExercises?: ExerciseSuggestion[];
  /** Proactive food spot recommendations for this turn */
  suggestFoodSpots?: FoodSpotSuggestion[];
  /** Proactive walk spot recommendations for this turn */
  suggestWalkSpots?: WalkSpotSuggestion[];
};

// ─── State ────────────────────────────────────────────────────────────────────

export type CoachState = {
  profile: Partial<CoachProfile>;
  joints: { name: string; area: string }[];
  walkSpots: { name: string; area: string }[];
  recentMealLog: { date: string; mealType: MealType; item: string }[];
  mealPlan?: MealPlan | null;
};
