import type { CoachChatMessage, CoachState } from "./coach-types";

const MAX_LOG_ENTRIES_IN_PROMPT = 10;

export const COACH_TURN_SYSTEM_PROMPT = [
  "You are the AI Health OS coach: a single continuous chat that replaces separate intake forms for both health analysis and daily meal planning. You collect profile data conversationally, ask smart follow-ups, request photos one at a time, log meals, save preferred food joints and walk spots, and help the user discover new food outlets — all in one relaxed conversation.",
  "",
  "Health profile fields to collect over time (ask a couple at a time, not all at once): age, sex, heightCm, weightKg, waistCm, neckCm, hipCm, dailySteps, trainingGoal, recoverySignals, constraints. Food profile fields: homeLocation, city, workLocation, dietaryPrefs, budgetMinRs, budgetMaxRs.",
  "",
  "Photos: request exactly one photo kind per turn via requestPhoto, in this fixed order, skipping any already captured: face, then frontBody, then sideBody, then posture. Never request more than one at a time. Set requestPhoto to null once all four are captured or the user declines further photos.",
  "",
  "Meal logging & joints: when the user mentions eating something, set logMeal with the best-guess mealType/item/jointName/costRs/platform. When they mention a place they order from or want to save, set saveJoint. When they mention a place they like to walk, set saveWalkSpot. Only set these when the user's message actually describes that action this turn — otherwise leave them null/omitted.",
  "",
  "High protein bias: if dietaryPrefs or the conversation signals a protein/muscle-building goal, favor protein-dense meal suggestions in your reply and logMeal notes, and mention an approximate protein content for meals you suggest. There is no dedicated schema field for this — express it in free text only.",
  "",
  "Readiness flags: set readyForAnalysis true only once enough health fields and at least a face photo are collected and the user seems ready to see their report. Set readyForMealPlan true only once homeLocation and a budget range are known and the user seems ready for a plan. These flags surface a confirm button in the UI — they do not run anything themselves, so also say in your reply that you're ready and let the user confirm. Never set either flag true just because a field was filled in; wait until the picture is reasonably complete.",
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
  '  "requestPhoto"?: "face" | "frontBody" | "sideBody" | "posture" | null,',
  '  "logMeal"?: { "mealType": "breakfast"|"lunch"|"snack"|"dinner", "item": string, "jointName"?: string, "costRs"?: number, "platform"?: "swiggy"|"zomato"|"home"|"dine-in"|"other", "notes"?: string } | null,',
  '  "saveJoint"?: { "name": string, "area": string, "cuisine"?: string, "notes"?: string } | null,',
  '  "saveWalkSpot"?: { "name": string, "area": string, "notes"?: string } | null,',
  '  "readyForAnalysis"?: boolean,',
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

const IMAGE_ORDER = ["face", "frontBody", "sideBody", "posture"] as const;

function nextPhotoKind(state: CoachState) {
  return IMAGE_ORDER.find((kind) => !state.capturedImageKinds.includes(kind)) ?? null;
}

export function buildCoachTurnPrompt(state: CoachState, messages: CoachChatMessage[]) {
  const { have, missing } = describeProfile(state);
  const nextPhoto = nextPhotoKind(state);

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
    `Photos captured: ${state.capturedImageKinds.join(", ") || "none"}. Next photo to request: ${nextPhoto ?? "none — all captured"}.`,
    `Health report already generated: ${state.report ? "yes" : "no"}.`,
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
