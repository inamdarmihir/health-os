import { NextResponse } from "next/server";
import { z } from "zod";
import { runCoachTurn, intelligenceConfigured } from "../../../src/lib/ai";
import type { CoachState, CoachChatMessage } from "../../../src/lib/coach-types";

export const runtime = "nodejs";
export const maxDuration = 30;

const attachmentSchema = z.object({
  kind: z.enum(["face", "frontBody", "sideBody", "posture"]),
  mimeType: z.string().min(1),
  data: z.string().min(1)
});

const messageSchema = z.object({
  role: z.enum(["user", "coach"]),
  content: z.string().max(4000),
  attachment: attachmentSchema.optional()
});

const profileSchema = z.object({
  age: z.number().optional(),
  sex: z.enum(["male", "female", "other", ""]).optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  waistCm: z.number().optional(),
  neckCm: z.number().optional(),
  hipCm: z.number().optional(),
  dailySteps: z.number().optional(),
  trainingGoal: z.string().optional(),
  recoverySignals: z.string().optional(),
  constraints: z.string().optional(),
  browserGoal: z.string().optional(),
  homeLocation: z.string().optional(),
  city: z.string().optional(),
  workLocation: z.string().optional(),
  dietaryPrefs: z.string().optional(),
  budgetMinRs: z.number().optional(),
  budgetMaxRs: z.number().optional()
});

const requestSchema = z.object({
  state: z.object({
    profile: profileSchema,
    capturedImageKinds: z.array(z.enum(["face", "frontBody", "sideBody", "posture"])),
    joints: z.array(z.object({ name: z.string(), area: z.string() })),
    walkSpots: z.array(z.object({ name: z.string(), area: z.string() })),
    recentMealLog: z.array(
      z.object({
        date: z.string(),
        mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
        item: z.string()
      })
    ),
    report: z.record(z.string(), z.unknown()).nullable().optional(),
    mealPlan: z.record(z.string(), z.unknown()).nullable().optional()
  }),
  messages: z.array(messageSchema).min(1).max(60)
});

export async function POST(request: Request) {
  if (!intelligenceConfigured()) {
    return NextResponse.json({ error: "No AI provider configured. Set GEMINI_API_KEY in your environment." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runCoachTurn(parsed.data.state as CoachState, parsed.data.messages as CoachChatMessage[]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coach chat failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
