import { NextResponse } from "next/server";
import { z } from "zod";
import { generateExerciseVisuals, getGeminiApiKey } from "../../../src/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  exercises: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(160),
      }),
    )
    .min(1)
    .max(4),
});

function buildIllustrationPrompt(name: string) {
  return [
    `Minimal flat-vector fitness illustration of a person performing "${name}".`,
    "Clean line art, single-subject isometric composition, dark charcoal (#111111) background,",
    "one warm yellow accent color (#ffd400) for outlines and highlights, no text, no watermark,",
    "square 1:1 composition, polished fitness-app icon aesthetic, high contrast, minimal shading.",
  ].join(" ");
}

/**
 * Generates a small illustrative icon per exercise suggestion via Nano Banana
 * (Gemini image gen), used by the coach chat's exercise recommendation cards.
 */
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
    const images = await generateExerciseVisuals(
      parsed.data.exercises.map((e) => ({ id: e.id, imagePrompt: buildIllustrationPrompt(e.name) })),
    );
    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
