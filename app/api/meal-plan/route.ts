import { NextResponse } from "next/server";
import { z } from "zod";
import { activeProvider, intelligenceConfigured, planMeals, resolveIntelligenceModel } from "../../../src/lib/ai";
import { findNearbyFoodEvidence } from "../../../src/lib/food-search";
import { exaConfigured } from "../../../src/lib/exa";
import type { MealPlan, MealPlanResponse } from "../../../src/lib/food-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const foodProfileSchema = z.object({
  homeLocation: z.string().min(1).max(200),
  city: z.string().max(100).optional(),
  workLocation: z.string().max(200).optional(),
  dietaryPrefs: z.string().max(300).optional(),
  budgetMinRs: z.number().min(50).max(5000),
  budgetMaxRs: z.number().min(50).max(5000)
});

const foodJointSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  area: z.string().max(150).default(""),
  cuisine: z.string().max(80).optional(),
  swiggyUrl: z.string().max(500).optional(),
  zomatoUrl: z.string().max(500).optional(),
  notes: z.string().max(300).optional()
});

const walkSpotSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  area: z.string().max(150).default(""),
  notes: z.string().max(300).optional()
});

const mealLogEntrySchema = z.object({
  id: z.string().min(1).max(60),
  date: z.string().min(8).max(10),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  item: z.string().min(1).max(160),
  jointName: z.string().max(120).optional(),
  costRs: z.number().min(0).max(5000).optional(),
  platform: z.enum(["swiggy", "zomato", "home", "dine-in", "other"]).optional(),
  notes: z.string().max(300).optional()
});

const requestSchema = z.object({
  profile: foodProfileSchema,
  joints: z.array(foodJointSchema).max(40).default([]),
  walkSpots: z.array(walkSpotSchema).max(20).default([]),
  recentLog: z.array(mealLogEntrySchema).max(120).default([]),
  date: z.string().min(8).max(10).optional()
});

export async function POST(request: Request) {
  if (!intelligenceConfigured()) {
    return NextResponse.json({ error: "No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY on the server." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { profile, joints, walkSpots, recentLog } = parsed.data;
  const targetDate = parsed.data.date || new Date().toISOString().slice(0, 10);

  if (profile.budgetMinRs > profile.budgetMaxRs) {
    return NextResponse.json({ error: "budgetMinRs must be <= budgetMaxRs." }, { status: 400 });
  }

  try {
    const searchHits = await findNearbyFoodEvidence(profile, joints);
    const generated = await planMeals(profile, joints, walkSpots, recentLog, searchHits, targetDate);

    const plan: MealPlan = {
      date: targetDate,
      budgetMinRs: profile.budgetMinRs,
      budgetMaxRs: profile.budgetMaxRs,
      sources: searchHits,
      ...generated
    };

    const payload: MealPlanResponse = {
      plan,
      models: { provider: activeProvider(), intelligence: resolveIntelligenceModel() },
      searchStatus: exaConfigured() ? "live" : "offline"
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meal plan generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
