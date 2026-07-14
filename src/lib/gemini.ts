import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, MealPlan, WalkSpot } from "./food-types";
import { buildMealPlanPrompt } from "./food-prompts";
import { GoogleGenAI } from "@google/genai";
import type { ExerciseVisual, HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate, RoutineExercise } from "./health-types";
import { formatMetricContext } from "./local-metrics";
import { extractJson } from "./json-utils";
import { MAX_ROUTINE_EXERCISES, buildHealthReportPrompt } from "./health-prompts";
import type { CoachChatMessage, CoachState, CoachTurnResult } from "./coach-types";
import { COACH_TURN_SYSTEM_PROMPT, buildCoachTurnPrompt } from "./coach-prompts";

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
      maxOutputTokens: 12288,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  const report = extractJson(response.text ?? "", finishReason) as HealthOsReport;
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

export async function runCoachTurn(state: CoachState, messages: CoachChatMessage[]): Promise<CoachTurnResult> {
  const ai = requireGeminiClient();
  const contextBlock = buildCoachTurnPrompt(state, messages);

  const contents = messages.map((message) => {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: message.content }];
    if (message.attachment) {
      parts.push({ inlineData: { mimeType: message.attachment.mimeType, data: message.attachment.data } });
    }
    return { role: message.role === "coach" ? "model" : "user", parts };
  });

  const response = await ai.models.generateContent({
    model: resolveTextModel(),
    contents,
    config: {
      systemInstruction: `${COACH_TURN_SYSTEM_PROMPT}\n\n${contextBlock}`,
      responseMimeType: "application/json",
      temperature: 0.5,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  return extractJson(response.text ?? "", finishReason) as CoachTurnResult;
}

export async function planMealsWithGemini(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string
): Promise<Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">> {
  const ai = requireGeminiClient();
  const prompt = buildMealPlanPrompt(profile, joints, walkSpots, recentLog, searchHits, targetDate);

  const response = await ai.models.generateContent({
    model: resolveTextModel(),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  return extractJson(response.text ?? "", finishReason) as Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">;
}
