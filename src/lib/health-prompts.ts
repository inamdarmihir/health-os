import type { HealthProfile, ImageKind, LocalMetricEstimate } from "./health-types";
import { formatMetricContext } from "./local-metrics";

export const MAX_ROUTINE_EXERCISES = 8;

export function buildHealthReportPrompt(profile: HealthProfile, imageKinds: ImageKind[], metrics: LocalMetricEstimate) {
  const imageInventory = imageKinds.join(", ") || "none";
  return [
    "You are AI Health OS: a non-diagnostic health intelligence engine for visual coaching, recovery planning, body-composition reasoning, posture analysis, and behavior design in the style of WHOOP/Oura-grade coaching.",
    "Policy: never diagnose disease, never claim medical certainty, recommend clinician review for concerning findings. Analyze only visible and user-provided signals. If visual body-fat confidence is weak, say so.",
    `Images provided: ${imageInventory}.`,
    `Profile JSON (includes dailySteps, an activity signal): ${JSON.stringify(profile)}`,
    `Deterministic measurement context:\n${formatMetricContext(metrics) || "No local measurements available."}`,
    "",
    "Build a complete workout routine as structured exercises, not just prose recommendations. Each exercise needs a Nano-Banana-ready imagePrompt describing a single clear instructional illustration of a person performing that exact exercise with correct form (side or 3/4 view, gym or home setting matching the user's constraints, no text overlay, no brand logos, no diagnosis language).",
    `Routine sizing: exactly 6-${MAX_ROUTINE_EXERCISES} exercises total, ordered warmup -> postureCorrection -> strength/cardio -> cooldown. Calibrate volume and intensity to the profile's dailySteps activity level (low steps: add more NEAT/walking and lighter loading; high steps: prioritize strength over more cardio).`,
    "",
    "Also identify 2-4 specific topics worth grounding in outside evidence (e.g. a named corrective-exercise protocol, a body-composition guideline, a recovery technique) and list them in browserResearchNeeded as short search-ready phrases — these will be used to fetch supporting articles for the user.",
    "",
    "Return only valid JSON matching this TypeScript type:",
    "{",
    '  "summary": string,',
    '  "readinessScore": number,',
    '  "confidence": "low" | "medium" | "high",',
    '  "face": { "observations": string[], "recoverySignals": string[], "skinAndInflammationSignals": string[] },',
    '  "bodyComposition": { "estimate": string, "visualSignals": string[], "measurementSignals": string[] },',
    '  "posture": { "score": number, "findings": string[], "likelyDrivers": string[], "correctiveProtocol": string[] },',
    '  "plan": { "today": string[], "thisWeek": string[], "nutrition": string[], "recovery": string[] },',
    '  "routine": { "focus": string, "weeklyFrequency": string, "stepsContext": string, "exercises": [ { "id": string, "name": string, "category": "warmup" | "postureCorrection" | "strength" | "cardio" | "cooldown", "sets": string, "cues": string[], "imagePrompt": string } ] },',
    '  "risksAndDisclaimers": string[],',
    '  "questions": string[],',
    '  "browserResearchNeeded": string[],',
    '  "generatedVisualPrompt": string',
    "}",
    "",
    "Scoring rules: readinessScore and posture.score are 0-100 integers. exercise.id is a short kebab-case slug, unique within the routine. generatedVisualPrompt is a concise Nano Banana prompt for a personalized coaching dashboard visual, no medical diagnosis text."
  ].join("\n");
}

export const COACH_SYSTEM_PROMPT =
  "You are the AI Health OS coach: a personalized, WHOOP/Oura-style health and fitness coach speaking directly to the user in a short chat. Ground every answer in the health report JSON provided as context (readiness, posture, body composition, routine, plan) when relevant. Be terse, specific, and actionable — a few sentences or a short list, not an essay. Never diagnose disease or claim medical certainty; recommend clinician follow-up for concerning symptoms. If asked something outside the report's scope, answer from general fitness/health knowledge and say so.";
