import { NextResponse } from "next/server";
import { z } from "zod";
import { generateHealthVisual, getGeminiApiKey } from "../../../src/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  prompt: z.string().min(8).max(2000),
  reference: z
    .object({
      kind: z.enum(["face", "frontBody", "sideBody", "posture"]),
      mimeType: z.string().min(3),
      data: z.string().min(10)
    })
    .optional()
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

  try {
    const image = await generateHealthVisual(parsed.data.prompt, parsed.data.reference);
    return NextResponse.json({ image });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nano Banana generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
