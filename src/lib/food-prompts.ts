import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, WalkSpot } from "./food-types";

const MAX_LOG_ENTRIES_IN_PROMPT = 21;

export function buildMealPlanPrompt(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string
) {
  const budgetMin = profile.budgetMinRs || 500;
  const budgetMax = profile.budgetMaxRs || 700;

  const recentSummary =
    recentLog
      .slice(-MAX_LOG_ENTRIES_IN_PROMPT)
      .map(
        (entry) =>
          `${entry.date} ${entry.mealType}: ${entry.item}${entry.jointName ? ` @ ${entry.jointName}` : ""}${
            entry.costRs ? ` (₹${entry.costRs})` : ""
          }`
      )
      .join("\n") || "No meals logged yet.";

  const jointsSummary = joints.length
    ? joints
        .map(
          (j) =>
            `- ${j.name} (${j.area}${j.cuisine ? `, ${j.cuisine}` : ""})${j.swiggyUrl ? ` swiggy:${j.swiggyUrl}` : ""}${
              j.zomatoUrl ? ` zomato:${j.zomatoUrl}` : ""
            }${j.notes ? ` — ${j.notes}` : ""}`
        )
        .join("\n")
    : "No saved joints yet — recommend well-known chains or local spot types plausible for the area, and say estimates are unverified.";

  const walkSummary = walkSpots.length
    ? walkSpots.map((w) => `- ${w.name} (${w.area})${w.notes ? ` — ${w.notes}` : ""}`).join("\n")
    : "No saved walk spots — suggest a generic nearby walk (park, market street, waterfront, etc.) appropriate for the area.";

  const evidenceSummary = searchHits.length
    ? searchHits.map((h) => `- [${h.jointName}] ${h.title}: ${h.url}${h.snippet ? ` — ${h.snippet}` : ""}`).join("\n")
    : "No live Swiggy/Zomato search evidence available — reason from general knowledge of the joints/cuisine and say so in budgetNote.";

  return [
    "You are a daily meal-planning assistant for a single user in India who orders via Swiggy/Zomato or eats at preferred local joints.",
    `Plan date: ${targetDate}.`,
    `Home/base location: ${profile.homeLocation || "unspecified"}${profile.city ? `, ${profile.city}` : ""}.`,
    profile.workLocation ? `Other frequent location: ${profile.workLocation}.` : "",
    profile.dietaryPrefs ? `Dietary preferences/restrictions: ${profile.dietaryPrefs}.` : "No stated dietary restrictions.",
    `Daily food budget: ₹${budgetMin}-₹${budgetMax} TOTAL across all meals for the day. Stay inside this range — do not wildly undershoot or overshoot it.`,
    "",
    "Saved preferred food joints:",
    jointsSummary,
    "",
    "Saved walk spots:",
    walkSummary,
    "",
    `Recent meal log, most recent last (avoid repeating the same item/joint two days running; rotate cuisines and joints for variety):\n${recentSummary}`,
    "",
    `Live web evidence on nearby menus/prices (from Swiggy/Zomato search, may be partial or absent):\n${evidenceSummary}`,
    "",
    "Build a full day's meal plan (breakfast, lunch, snack, dinner — you may drop snack if the budget is tight, but always keep breakfast, lunch, and dinner) picking specific items from the preferred joints when they plausibly fit the budget, otherwise a reasonable nearby alternative. Estimate a realistic Swiggy/Zomato price in INR per meal (roughly including delivery/packaging where relevant). The sum of estimatedCostRs across all meals MUST land inside the stated budget range. Favor variety against the recent log. Recommend exactly one walk (with timing relative to a meal, e.g. \"after dinner\") chosen from the saved spots when one fits, else a sensible generic suggestion.",
    "",
    "Return only valid JSON matching this TypeScript type:",
    "{",
    '  "meals": [ { "mealType": "breakfast"|"lunch"|"snack"|"dinner", "item": string, "jointName": string, "platform": "swiggy"|"zomato"|"home"|"dine-in", "estimatedCostRs": number, "reason": string, "orderUrl"?: string } ],',
    '  "estimatedTotalRs": number,',
    '  "budgetNote": string,',
    '  "varietyNote": string,',
    '  "walk": { "spotName": string, "timing": string, "reason": string } | null',
    "}",
    "",
    "Rules: estimatedTotalRs is the exact sum of every meal's estimatedCostRs and MUST fall within the stated budget range. jointName should match a saved joint's name when you used one. Only set orderUrl when you have a real matching swiggyUrl/zomatoUrl from the saved joints list or a URL from the web evidence above — never invent a URL."
  ]
    .filter(Boolean)
    .join("\n");
}

export const FOOD_PLAN_SYSTEM_PROMPT =
  "You are a precise, budget-disciplined Indian food-delivery meal planner. You reason about real Swiggy/Zomato ordering patterns, realistic INR pricing, and daily nutritional variety. You never invent URLs and you always respect the stated budget range.";
