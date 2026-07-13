import { NextResponse } from "next/server";
import { getGeminiApiKey, resolveImageModel, resolveTextModel } from "../../../src/lib/gemini";
import { browserAutomationEnabled } from "../../../src/lib/browser-tool";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    geminiConfigured: Boolean(getGeminiApiKey()),
    browserAutomation: browserAutomationEnabled(),
    intelligenceModel: resolveTextModel(),
    imageModel: resolveImageModel()
  });
}
