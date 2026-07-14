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

export type CoachTurnResult = {
  reply: string;
  profileUpdates?: Partial<CoachProfile>;
  logMeal?: CoachMealLogDraft | null;
  saveJoint?: CoachJointDraft | null;
  saveWalkSpot?: CoachWalkSpotDraft | null;
  readyForMealPlan?: boolean;
};

export type CoachState = {
  profile: Partial<CoachProfile>;
  joints: { name: string; area: string }[];
  walkSpots: { name: string; area: string }[];
  recentMealLog: { date: string; mealType: MealType; item: string }[];
  mealPlan?: MealPlan | null;
};
