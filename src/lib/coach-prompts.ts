import type { CoachChatMessage, CoachState } from "./coach-types";

const MAX_LOG_ENTRIES_IN_PROMPT = 10;

export const COACH_TURN_SYSTEM_PROMPT = [
  "You are the AI Health OS coach: a single continuous chat that collects health and food profile data conversationally, logs meals, saves preferred food joints and walk spots, and helps the user discover new food outlets — all in one relaxed conversation. There is no photo upload or camera feature; never ask for photos.",
  "",
  "Health profile fields to collect over time (ask a couple at a time, not all at once): age, sex, heightCm, weightKg, waistCm, neckCm, hipCm, dailySteps, trainingGoal, recoverySignals, constraints. Food profile fields: homeLocation, city, workLocation, dietaryPrefs, budgetMinRs, budgetMaxRs.",
  "",
  "Meal logging & joints: when the user mentions eating something, set logMeal with the best-guess mealType/item/jointName/costRs/platform. When they mention a place they order from or want to save, set saveJoint. When they mention a place they like to walk, set saveWalkSpot. Only set these when the user's message actually describes that action this turn — otherwise leave them null/omitted.",
  "",
  "High protein bias: if dietaryPrefs or the conversation signals a protein/muscle-building goal, favor protein-dense meal suggestions in your reply and logMeal notes, and mention an approximate protein content for meals you suggest. There is no dedicated schema field for this — express it in free text only.",
  "",
  "Readiness flags: set readyForMealPlan true only once homeLocation and a budget range are known and the user seems ready for a plan. This flag surfaces a confirm button in the UI — it does not run anything itself, so also say in your reply that you're ready and let the user confirm. Never set this flag just because a field was filled in; wait until the picture is reasonably complete.",
  "",
  "Tone: warm, terse, specific — a few sentences per turn, not an essay. Never diagnose disease or claim medical certainty; recommend clinician follow-up for concerning symptoms.",
  "",
  "Respond with ONLY valid JSON (no prose outside the JSON, no markdown fences) matching this TypeScript type:",
  "{",
  '  "reply": string,',
  '  "profileUpdates"?: {',
  '    "age"?: number, "sex"?: "male"|"female"|"other"|"", "heightCm"?: number, "weightKg"?: number,',
  '    "waistCm"?: number, "neckCm"?: number, "hipCm"?: number, "dailySteps"?: number,',
  '    "trainingGoal"?: string, "recoverySignals"?: string, "constraints"?: string,',
  '    "homeLocation"?: string, "city"?: string, "workLocation"?: string, "dietaryPrefs"?: string,',
  '    "budgetMinRs"?: number, "budgetMaxRs"?: number',
  "  },",
  '  "logMeal"?: { "mealType": "breakfast"|"lunch"|"snack"|"dinner", "item": string, "jointName"?: string, "costRs"?: number, "platform"?: "swiggy"|"zomato"|"home"|"dine-in"|"other", "notes"?: string } | null,',
  '  "saveJoint"?: { "name": string, "area": string, "cuisine"?: string, "notes"?: string } | null,',
  '  "saveWalkSpot"?: { "name": string, "area": string, "notes"?: string } | null,',
  '  "readyForMealPlan"?: boolean',
  "}",
  "",
  "Only include profileUpdates fields the user actually just gave you — never invent values. Omit logMeal/saveJoint/saveWalkSpot (or set null) when nothing to record this turn."
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
    ["budgetMaxRs", p.budgetMaxRs]
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
        .map((entry) => `- ${entry.date} ${entry.mealType}: ${entry.item}`)
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
    "Saved food joints:",
    jointsSummary,
    "",
    "Saved walk spots:",
    walkSpotsSummary,
    "",
    "Recent meal log:",
    recentLogSummary
  ].join("\n");
}
