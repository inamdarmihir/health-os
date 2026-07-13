import { GoogleGenAI } from "@google/genai";
import type { ChatMessage, ExerciseVisual, HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate, RoutineExercise } from "./health-types";
import { formatMetricContext } from "./local-metrics";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const MAX_ROUTINE_EXERCISES = 8;

export function resolveTextModel() {
  return process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export function resolveImageModel() {
  return process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

export function requireGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it in Vercel Project Settings or .env.local.");
  }
  process.env.GOOGLE_API_KEY ||= apiKey;
  return new GoogleGenAI({ apiKey });
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1]);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new Error("Gemini did not return JSON.");
}

export async function analyzeHealthWithGemini(profile: HealthProfile, images: ImageInput[], metrics: LocalMetricEstimate): Promise<HealthOsReport> {
  const ai = requireGeminiClient();
  const imageInventory = images.map((image) => image.kind).join(", ") || "none";
  const prompt = [
    "You are AI Health OS: a non-diagnostic health intelligence engine for visual coaching, recovery planning, body-composition reasoning, posture analysis, and behavior design in the style of WHOOP/Oura-grade coaching.",
    "Policy: never diagnose disease, never claim medical certainty, recommend clinician review for concerning findings. Analyze only visible and user-provided signals. If visual body-fat confidence is weak, say so.",
    `Images provided: ${imageInventory}.`,
    `Profile JSON (includes dailySteps, an activity signal): ${JSON.stringify(profile)}`,
    `Deterministic measurement context:\n${formatMetricContext(metrics) || "No local measurements available."}`,
    "",
    "Build a complete workout routine as structured exercises, not just prose recommendations. Each exercise needs a Nano-Banana-ready imagePrompt describing a single clear instructional illustration of a person performing that exact exercise with correct form (side or 3/4 view, gym or home setting matching the user's constraints, no text overlay, no brand logos, no diagnosis language).",
    `Routine sizing: exactly 6-${MAX_ROUTINE_EXERCISES} exercises total, ordered warmup -> postureCorrection -> strength/cardio -> cooldown. Calibrate volume and intensity to the profile's dailySteps activity level (low steps: add more NEAT/walking and lighter loading; high steps: prioritize strength over more cardio).`,
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

  const response = await ai.models.generateContent({
    model: resolveTextModel(),
    contents: [{ role: "user", parts: [{ text: prompt }, ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } }))] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.25,
      maxOutputTokens: 6144
    }
  });

  const report = extractJson(response.text ?? "") as HealthOsReport;
  report.routine.exercises = report.routine.exercises.slice(0, MAX_ROUTINE_EXERCISES);
  return report;
}

export async function generateHealthVisual(prompt: string, reference?: ImageInput) {
  const ai = requireGeminiClient();
  const input = reference
    ? [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: reference.mimeType, data: reference.data } }
          ]
        }
      ]
    : prompt;

  const interaction = await ai.interactions.create({
    model: resolveImageModel(),
    input
  });

  const image = interaction.output_image;
  if (!image?.data) throw new Error("Nano Banana did not return an image.");
  return {
    mimeType: image.mime_type || "image/png",
    data: image.data
  };
}

export async function generateExerciseVisuals(exercises: Pick<RoutineExercise, "id" | "imagePrompt">[]): Promise<ExerciseVisual[]> {
  const settled = await Promise.allSettled(
    exercises.map(async (exercise) => {
      const image = await generateHealthVisual(exercise.imagePrompt);
      return { id: exercise.id, mimeType: image.mimeType, data: image.data } satisfies ExerciseVisual;
    })
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<ExerciseVisual> => result.status === "fulfilled")
    .map((result) => result.value);
}

const COACH_SYSTEM_PROMPT = "You are the AI Health OS coach: a personalized, WHOOP/Oura-style health and fitness coach speaking directly to the user in a short chat. Ground every answer in the health report JSON provided as context (readiness, posture, body composition, routine, plan) when relevant. Be terse, specific, and actionable — a few sentences or a short list, not an essay. Never diagnose disease or claim medical certainty; recommend clinician follow-up for concerning symptoms. If asked something outside the report's scope, answer from general fitness/health knowledge and say so.";

export async function chatWithCoach(messages: ChatMessage[], reportContext: HealthOsReport | null): Promise<string> {
  const ai = requireGeminiClient();
  const contextBlock = reportContext
    ? `Current health report JSON:\n${JSON.stringify(reportContext)}`
    : "No health report has been generated yet for this user.";

  const response = await ai.models.generateContent({
    model: resolveTextModel(),
    contents: messages.map((message) => ({
      role: message.role === "coach" ? "model" : "user",
      parts: [{ text: message.content }]
    })),
    config: {
      systemInstruction: `${COACH_SYSTEM_PROMPT}\n\n${contextBlock}`,
      temperature: 0.5,
      maxOutputTokens: 1024
    }
  });

  return response.text ?? "I couldn't generate a response — try asking again.";
}
