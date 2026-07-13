import OpenAI from "openai";
import type { ChatMessage, HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate } from "./health-types";
import { extractJson } from "./json-utils";
import { MAX_ROUTINE_EXERCISES, buildHealthReportPrompt, COACH_SYSTEM_PROMPT } from "./health-prompts";

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

export async function chatWithOpenAiCoach(messages: ChatMessage[], reportContext: HealthOsReport | null): Promise<string> {
  const client = requireOpenAiClient();
  const contextBlock = reportContext
    ? `Current health report JSON:\n${JSON.stringify(reportContext)}`
    : "No health report has been generated yet for this user.";

  const response = await client.responses.create({
    model: resolveOpenAiTextModel(),
    instructions: `${COACH_SYSTEM_PROMPT}\n\n${contextBlock}`,
    input: messages.map((message) => ({
      role: message.role === "coach" ? ("assistant" as const) : ("user" as const),
      content: message.content
    })),
    reasoning: { effort: "low" },
    max_output_tokens: 1024
  });

  return response.output_text || "I couldn't generate a response — try asking again.";
}
