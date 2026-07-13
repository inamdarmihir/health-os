import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeHealthWithGemini, getGeminiApiKey, resolveImageModel, resolveTextModel } from "../../../src/lib/gemini";
import { estimateLocalMetrics } from "../../../src/lib/local-metrics";
import { runHealthDeepAgent } from "../../../src/lib/deep-health-agent";
import { browserAutomationEnabled } from "../../../src/lib/browser-tool";
import type { HealthOsResponse, ImageInput } from "../../../src/lib/health-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const imageSchema = z.object({
  kind: z.enum(["face", "frontBody", "sideBody", "posture"]),
  mimeType: z.string().min(3),
  data: z.string().min(10)
});

const profileSchema = z.object({
  age: z.number().min(10).max(100).optional(),
  sex: z.enum(["male", "female", "other", ""]).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(25).max(300).optional(),
  waistCm: z.number().min(30).max(250).optional(),
  neckCm: z.number().min(15).max(80).optional(),
  hipCm: z.number().min(40).max(250).optional(),
  dailySteps: z.number().min(0).max(100000).optional(),
  trainingGoal: z.string().max(400).optional(),
  recoverySignals: z.string().max(400).optional(),
  constraints: z.string().max(400).optional(),
  browserGoal: z.string().max(400).optional()
});

const requestSchema = z.object({
  profile: profileSchema,
  images: z.array(imageSchema).min(1).max(4),
  runDeepAgent: z.boolean().optional()
});

export async function POST(request: Request) {
  if (!getGeminiApiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { profile, images, runDeepAgent = true } = parsed.data;
  const metrics = estimateLocalMetrics(profile);

  try {
    const report = await analyzeHealthWithGemini(profile, images as ImageInput[], metrics);

    const deepAgentResult = runDeepAgent
      ? await runHealthDeepAgent(profile, metrics, report)
      : { agentBrief: "", status: "disabled" as const };

    const payload: HealthOsResponse = {
      report,
      localMetrics: metrics,
      agentBrief: deepAgentResult.agentBrief,
      agentStatus: deepAgentResult.status,
      browserStatus: browserAutomationEnabled() ? "enabled" : "disabled (set ENABLE_AGENT_BROWSER=true with Chrome for Testing provisioned)",
      models: { intelligence: resolveTextModel(), image: resolveImageModel() }
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis failure.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
