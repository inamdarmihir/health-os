import type { FoodJoint, FoodProfile, FoodSearchHit, MealLogEntry, MealPlan, WalkSpot } from "./food-types";
import { buildMealPlanPrompt, FOOD_PLAN_SYSTEM_PROMPT } from "./food-prompts";
import OpenAI from "openai";
import type { HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate } from "./health-types";
import { extractJson } from "./json-utils";
import { MAX_ROUTINE_EXERCISES, buildHealthReportPrompt } from "./health-prompts";
import type { CoachChatMessage, CoachState, CoachTurnResult } from "./coach-types";
import { COACH_TURN_SYSTEM_PROMPT, buildCoachTurnPrompt } from "./coach-prompts";

const DEFAULT_TEXT_MODEL = "gpt-5.6-sol";

export function resolveOpenAiTextModel() {
  return process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

export function requireOpenAiClient() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it in Vercel Project Settings or .env.local.");
  }
  return new OpenAI({ apiKey });
}

export async function analyzeHealthWithOpenAi(profile: HealthProfile, images: ImageInput[], metrics: LocalMetricEstimate): Promise<HealthOsReport> {
  const client = requireOpenAiClient();
  const prompt = buildHealthReportPrompt(profile, images.map((image) => image.kind), metrics);

  const response = await client.responses.create({
    model: resolveOpenAiTextModel(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.map((image) => ({
            type: "input_image" as const,
            image_url: `data:${image.mimeType};base64,${image.data}`,
            detail: "auto" as const
          }))
        ]
      }
    ],
    reasoning: { effort: "medium" },
    text: { format: { type: "json_object" } },
    max_output_tokens: 6144
  });

  const report = extractJson(response.output_text ?? "") as HealthOsReport;
  report.routine.exercises = report.routine.exercises.slice(0, MAX_ROUTINE_EXERCISES);
  return report;
}

export async function runCoachTurn(state: CoachState, messages: CoachChatMessage[]): Promise<CoachTurnResult> {
  const client = requireOpenAiClient();
  const contextBlock = buildCoachTurnPrompt(state, messages);

  const input = messages.map((message) => {
    if (message.role === "user" && message.attachment) {
      return {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: message.content },
          {
            type: "input_image" as const,
            image_url: `data:${message.attachment.mimeType};base64,${message.attachment.data}`,
            detail: "auto" as const
          }
        ]
      };
    }
    return {
      role: message.role === "coach" ? ("assistant" as const) : ("user" as const),
      content: message.content
    };
  });

  const response = await client.responses.create({
    model: resolveOpenAiTextModel(),
    instructions: `${COACH_TURN_SYSTEM_PROMPT}\n\n${contextBlock}`,
    input,
    reasoning: { effort: "low" },
    text: { format: { type: "json_object" } },
    max_output_tokens: 2048
  });

  return extractJson(response.output_text ?? "") as CoachTurnResult;
}

export async function planMealsWithOpenAi(
  profile: FoodProfile,
  joints: FoodJoint[],
  walkSpots: WalkSpot[],
  recentLog: MealLogEntry[],
  searchHits: FoodSearchHit[],
  targetDate: string
): Promise<Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">> {
  const client = requireOpenAiClient();
  const prompt = buildMealPlanPrompt(profile, joints, walkSpots, recentLog, searchHits, targetDate);

  const response = await client.responses.create({
    model: resolveOpenAiTextModel(),
    instructions: FOOD_PLAN_SYSTEM_PROMPT,
    input: [{ role: "user", content: prompt }],
    reasoning: { effort: "low" },
    text: { format: { type: "json_object" } },
    max_output_tokens: 2048
  });

  return extractJson(response.output_text ?? "") as Omit<MealPlan, "date" | "budgetMinRs" | "budgetMaxRs" | "sources" | "discoveredOutlets">;
}
