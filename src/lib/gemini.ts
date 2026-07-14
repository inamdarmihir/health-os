import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, MealPlan, WalkSpot } from "./food-types";
import { buildMealPlanPrompt } from "./food-prompts";
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage, ExerciseVisual, HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate, RoutineExercise } from "./health-types";
import { formatMetricContext } from "./local-metrics";
import { extractJson } from "./json-utils";
import { MAX_ROUTINE_EXERCISES, buildHealthReportPrompt, COACH_SYSTEM_PROMPT } from "./health-prompts";

const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";

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

export async function analyzeHealthWithGemini(profile: HealthProfile, images: ImageInput[], metrics: LocalMetricEstimate): Promise<HealthOsReport> {
  const ai = requireGeminiClient();
  const prompt = buildHealthReportPrompt(profile, images.map((image) => image.kind), metrics);

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

export async function planMealsWithGemini(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string
): Promise<Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources">> {
  const ai = requireGeminiClient();
  const prompt = buildMealPlanPrompt(profile, joints, walkSpots, recentLog, searchHits, targetDate);

  const response = await ai.models.generateContent({
    model: resolveTextModel(),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  });

  return extractJson(response.text ?? "") as Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources">;
}
