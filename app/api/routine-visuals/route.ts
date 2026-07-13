import { NextResponse } from "next/server";
import { z } from "zod";
import { generateExerciseVisuals, getGeminiApiKey } from "../../../src/lib/gemini";
import { findExerciseVideos } from "../../../src/lib/exa";

export const runtime = "nodejs";
export const maxDuration = 90;

const requestSchema = z.object({
  exercises: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(160),
        category: z.string().min(1).max(40),
        imagePrompt: z.string().min(8).max(1200)
      })
    )
    .min(1)
    .max(8)
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
    const [images, videos] = await Promise.all([
      generateExerciseVisuals(parsed.data.exercises),
      findExerciseVideos(parsed.data.exercises)
    ]);
    return NextResponse.json({ images, videos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Routine enrichment failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
