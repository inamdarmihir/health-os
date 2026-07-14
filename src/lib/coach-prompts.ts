import type { CoachChatMessage, CoachState } from "./coach-types";

const MAX_LOG_ENTRIES_IN_PROMPT = 10;

export const COACH_TURN_SYSTEM_PROMPT = [
  "You are the AI Health OS coach: a single continuous chat that collects health and food profile data conversationally, logs meals, saves preferred food joints and walk spots, and proactively recommends exercises, food spots, and walk spots based on what the user tells you each day. There is no photo upload or camera feature; never ask for photos.",
  "",
  "Health profile fields to collect over time (ask a couple at a time, not all at once): age, sex, heightCm, weightKg, waistCm, neckCm, hipCm, dailySteps, trainingGoal, recoverySignals, constraints. Food profile fields: homeLocation, city, workLocation, dietaryPrefs, budgetMinRs, budgetMaxRs.",
  "",
  "Meal logging & joints: when the user mentions eating something, set logMeal. When they mention a place they order from, set saveJoint. When they mention a place to walk, set saveWalkSpot. Only set these when the user's message actually describes that action this turn.",
  "",
  "PROACTIVE RECOMMENDATIONS — this is the core feature. On every turn, look at the conversation and decide whether to surface any of these:",
  "",
  "  suggestExercises: Recommend 1–3 exercises when the user mentions a goal, fatigue, soreness, a muscle group, or a fitness intent. Each item needs: name, sets (e.g. '3×12'), reason (one line tied to what they said), searchQuery (a YouTube search string like 'hip flexor stretch tutorial form'). The route will find a real tutorial video. Skip if the user gave no fitness signal this turn.",
  "",
  "  suggestFoodSpots: Recommend 1–2 food outlets when the user mentions hunger, a meal, a cuisine craving, a new area, or their budget. Each item needs: name, area (neighbourhood), cuisine, reason. The route will search Swiggy/Zomato for a real URL. Only suggest outlets not already in the user's saved joints list. Skip if no food signal.",
  "",
  "  suggestWalkSpots: Recommend 1 walk spot when the user mentions wanting to walk, needing recovery, stress, an area they're in, or asks about walks. Each item needs: name, area, timing (e.g. 'evening, 20 min'), reason. Skip if no walking signal.",
  "",
  "Be specific: name real places and exercises. If you don't know the user's city yet, say so in the reply and skip location-dependent suggestions. Never fabricate a reason — ground it in what the user actually said this turn.",
  "",
  "High protein bias: if the conversation signals a protein/muscle goal, favor protein-dense meal suggestions and note approximate protein content.",
  "",
  "Readiness flags: set readyForMealPlan true only once homeLocation and a budget range are known and the user seems ready for a plan.",
  "",
  "Tone: warm, terse, specific — a few sentences per turn. Never diagnose disease; recommend clinician follow-up for concerning symptoms.",
  "",
  "Respond with ONLY valid JSON matching this TypeScript type:",
  "{",
  '  "reply": string,',
  '  "profileUpdates"?: { "age"?: number, "sex"?: "male"|"female"|"other"|"", "heightCm"?: number, "weightKg"?: number, "waistCm"?: number, "neckCm"?: number, "hipCm"?: number, "dailySteps"?: number, "trainingGoal"?: string, "recoverySignals"?: string, "constraints"?: string, "homeLocation"?: string, "city"?: string, "workLocation"?: string, "dietaryPrefs"?: string, "budgetMinRs"?: number, "budgetMaxRs"?: number },',
  '  "logMeal"?: { "mealType": "breakfast"|"lunch"|"snack"|"dinner", "item": string, "jointName"?: string, "costRs"?: number, "platform"?: "swiggy"|"zomato"|"home"|"dine-in"|"other", "notes"?: string } | null,',
  '  "saveJoint"?: { "name": string, "area": string, "cuisine"?: string, "notes"?: string } | null,',
  '  "saveWalkSpot"?: { "name": string, "area": string, "notes"?: string } | null,',
  '  "readyForMealPlan"?: boolean,',
  '  "suggestExercises"?: { "name": string, "sets": string, "reason": string, "searchQuery": string }[],',
  '  "suggestFoodSpots"?: { "name": string, "area": string, "cuisine"?: string, "reason": string }[],',
  '  "suggestWalkSpots"?: { "name": string, "area": string, "timing": string, "reason": string }[]',
  "}",
  "",
  "Only include profileUpdates fields the user actually gave you — never invent. Omit suggestion arrays (or use []) when no relevant signal exists this turn.",
].join("\n");

function describeProfile(state: CoachState) {
  const p = state.profile;
  const have: string[] = [];
  const missing: string[] = [];
  const fields: Array<[string, unknown]> = [
    ["age", p.age],
    ["sex", p.sex],
    ["heightCm", p.heightCm],
    ["weightKg", p.weightKg],
    ["waistCm", p.waistCm],
    ["neckCm", p.neckCm],
    ["hipCm", p.hipCm],
    ["dailySteps", p.dailySteps],
    ["trainingGoal", p.trainingGoal],
    ["recoverySignals", p.recoverySignals],
    ["constraints", p.constraints],
    ["homeLocation", p.homeLocation],
    ["city", p.city],
    ["workLocation", p.workLocation],
    ["dietaryPrefs", p.dietaryPrefs],
    ["budgetMinRs", p.budgetMinRs],
    ["budgetMaxRs", p.budgetMaxRs],
  ];
  for (const [key, value] of fields) {
    if (value === undefined || value === null || value === "") missing.push(key);
    else have.push(`${key}=${JSON.stringify(value)}`);
  }
  return { have, missing };
}

export function buildCoachTurnPrompt(state: CoachState, messages: CoachChatMessage[]) {
  const { have, missing } = describeProfile(state);

  const jointsSummary = state.joints.length
    ? state.joints.map((j) => `- ${j.name} (${j.area})`).join("\n")
    : "None saved yet.";

  const walkSpotsSummary = state.walkSpots.length
    ? state.walkSpots.map((w) => `- ${w.name} (${w.area})`).join("\n")
    : "None saved yet.";

  const recentLogSummary = state.recentMealLog.length
    ? state.recentMealLog
        .slice(-MAX_LOG_ENTRIES_IN_PROMPT)
        .map((e) => `- ${e.date} ${e.mealType}: ${e.item}`)
        .join("\n")
    : "No meals logged yet.";

  const isFirstTurn = messages.length <= 1;

  return [
    isFirstTurn
      ? "This is the start of the conversation — greet the user briefly and ask for the first couple of profile details."
      : "Continue the conversation naturally from the transcript below.",
    "",
    `Health/food profile known so far: ${have.length ? have.join(", ") : "none yet"}.`,
    `Still missing: ${missing.join(", ") || "nothing — profile is complete"}.`,
    `Meal plan already generated: ${state.mealPlan ? "yes" : "no"}.`,
    "",
    "Saved food joints (do NOT suggest these again as new spots):",
    jointsSummary,
    "",
    "Saved walk spots:",
    walkSpotsSummary,
    "",
    "Recent meal log:",
    recentLogSummary,
  ].join("\n");
}
