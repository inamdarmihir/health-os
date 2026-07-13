import { NextResponse } from "next/server";
import { getGeminiApiKey, resolveImageModel } from "../../../src/lib/gemini";
import { getOpenAiApiKey } from "../../../src/lib/openai";
import { activeProvider, resolveIntelligenceModel } from "../../../src/lib/ai";
import { browserAutomationEnabled } from "../../../src/lib/browser-tool";
import { exaConfigured } from "../../../src/lib/exa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    provider: activeProvider(),
    geminiConfigured: Boolean(getGeminiApiKey()),
    openaiConfigured: Boolean(getOpenAiApiKey()),
    exaConfigured: exaConfigured(),
    browserAutomation: browserAutomationEnabled(),
    intelligenceModel: resolveIntelligenceModel(),
    imageModel: resolveImageModel()
  });
}
