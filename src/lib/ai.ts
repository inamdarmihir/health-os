import type { ChatMessage, HealthOsReport, HealthProfile, ImageInput, LocalMetricEstimate } from "./health-types";
import { analyzeHealthWithGemini, chatWithCoach as chatWithGeminiCoach, getGeminiApiKey, resolveTextModel as resolveGeminiTextModel } from "./gemini";
import { analyzeHealthWithOpenAi, chatWithOpenAiCoach, getOpenAiApiKey, resolveOpenAiTextModel } from "./openai";

export type AiProvider = "openai" | "gemini";

export function activeProvider(): AiProvider {
  const configured = (process.env.AI_PROVIDER || "").toLowerCase();
  if (configured === "openai" || configured === "gemini") return configured;
  return getOpenAiApiKey() ? "openai" : "gemini";
}

export function resolveIntelligenceModel() {
  return activeProvider() === "openai" ? resolveOpenAiTextModel() : resolveGeminiTextModel();
}

export function intelligenceConfigured() {
  return activeProvider() === "openai" ? Boolean(getOpenAiApiKey()) : Boolean(getGeminiApiKey());
}

export function analyzeHealth(profile: HealthProfile, images: ImageInput[], metrics: LocalMetricEstimate): Promise<HealthOsReport> {
  return activeProvider() === "openai"
    ? analyzeHealthWithOpenAi(profile, images, metrics)
    : analyzeHealthWithGemini(profile, images, metrics);
}

export function chatWithActiveCoach(messages: ChatMessage[], reportContext: HealthOsReport | null): Promise<string> {
  return activeProvider() === "openai"
    ? chatWithOpenAiCoach(messages, reportContext)
    : chatWithGeminiCoach(messages, reportContext);
}
