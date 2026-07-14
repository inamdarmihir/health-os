import { NextResponse } from "next/server";
import { getGeminiApiKey, resolveImageModel, resolveTextModel } from "../../../src/lib/gemini";
import { browserAutomationEnabled } from "../../../src/lib/browser-tool";
import { exaConfigured } from "../../../src/lib/exa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    geminiConfigured: Boolean(getGeminiApiKey()),
    exaConfigured: exaConfigured(),
    browserAutomation: browserAutomationEnabled(),
    intelligenceModel: resolveTextModel(),
    imageModel: resolveImageModel(),
  });
}
