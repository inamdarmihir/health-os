import type { HealthProfile, HealthOsReport, ImageKind } from "./health-types";
import type { FoodProfile, MealPlan, MealPlatform, MealType } from "./food-types";

export type CoachProfile = HealthProfile & FoodProfile;

export type CoachAttachment = {
  kind: ImageKind;
  mimeType: string;
  data: string;
};

export type CoachChatMessage = {
  role: "user" | "coach";
  content: string;
  attachment?: CoachAttachment;
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
  requestPhoto?: ImageKind | null;
  logMeal?: CoachMealLogDraft | null;
  saveJoint?: CoachJointDraft | null;
  saveWalkSpot?: CoachWalkSpotDraft | null;
  readyForAnalysis?: boolean;
  readyForMealPlan?: boolean;
};

export type CoachState = {
  profile: Partial<CoachProfile>;
  capturedImageKinds: ImageKind[];
  joints: { name: string; area: string }[];
  walkSpots: { name: string; area: string }[];
  recentMealLog: { date: string; mealType: MealType; item: string }[];
  report?: HealthOsReport | null;
  mealPlan?: MealPlan | null;
};
