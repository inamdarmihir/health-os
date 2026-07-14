export type FoodProfile = {
  homeLocation: string;
  city?: string;
  workLocation?: string;
  dietaryPrefs?: string;
  budgetMinRs: number;
  budgetMaxRs: number;
};

export type FoodJoint = {
  id: string;
  name: string;
  area: string;
  cuisine?: string;
  swiggyUrl?: string;
  zomatoUrl?: string;
  notes?: string;
};

export type WalkSpot = {
  id: string;
  name: string;
  area: string;
  notes?: string;
};

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";

export type MealPlatform = "swiggy" | "zomato" | "home" | "dine-in" | "other";

export type MealLogEntry = {
  id: string;
  date: string; // ISO yyyy-mm-dd, local
  mealType: MealType;
  item: string;
  jointName?: string;
  costRs?: number;
  platform?: MealPlatform;
  notes?: string;
};

export type FoodSearchHit = {
  jointName: string;
  title: string;
  url: string;
  snippet?: string;
};

export type SuggestedMeal = {
  mealType: MealType;
  item: string;
  jointName: string;
  platform: "swiggy" | "zomato" | "home" | "dine-in";
  estimatedCostRs: number;
  reason: string;
  orderUrl?: string;
};

export type WalkRecommendation = {
  spotName: string;
  timing: string;
  reason: string;
};

export type MealPlan = {
  date: string;
  budgetMinRs: number;
  budgetMaxRs: number;
  meals: SuggestedMeal[];
  estimatedTotalRs: number;
  budgetNote: string;
  varietyNote: string;
  walk: WalkRecommendation | null;
  sources: FoodSearchHit[];
};

export type MealPlanResponse = {
  plan: MealPlan;
  models: { provider: string; intelligence: string };
  searchStatus: "live" | "offline";
};
