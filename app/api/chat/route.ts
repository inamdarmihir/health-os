import { NextResponse } from "next/server";
import { z } from "zod";
import { chatWithActiveCoach, intelligenceConfigured } from "../../../src/lib/ai";
import type { HealthOsReport } from "../../../src/lib/health-types";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "coach"]),
        content: z.string().min(1).max(4000)
      })
    )
    .min(1)
    .max(40),
  report: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function POST(request: Request) {
  if (!intelligenceConfigured()) {
    return NextResponse.json({ error: "No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY on the server." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reply = await chatWithActiveCoach(parsed.data.messages, (parsed.data.report as HealthOsReport | null) ?? null);
    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coach chat failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
