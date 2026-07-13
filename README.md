# AI Health OS

Personal health-intelligence app, black/yellow WHOOP-style UI: capture face,
body, and posture photos, log today's steps, and get a vision-model report
(BMI/body-fat/waist-height metrics computed locally, posture and recovery
signals read from photos by Gemini), a deep-agent coaching brief from a
dynamic-subagent crew, a fully illustrated workout routine (every exercise
gets a Nano Banana form-visual and a real YouTube tutorial link via Exa
search), and a chat coach grounded in your report. Not a diagnostic tool —
every report carries clinician-referral language for concerning findings.

## Architecture

- **Next.js 15 App Router**, TypeScript, no client framework beyond React.
- `POST /api/analyze` — runs `gemini-2.5-flash` (vision) over the captured
  images + profile (including `dailySteps`, used to calibrate an
  `activityLevel` in `src/lib/local-metrics.ts` and the routine's volume),
  computes deterministic metrics (BMI, U.S. Navy body-fat formula,
  waist-to-height ratio), and returns a structured `routine.exercises[]`
  (warmup → posture correction → strength/cardio → cooldown, each with sets,
  form cues, and an image prompt) alongside the report. It then hands the
  vision report to a `deepagents` orchestrator (`src/lib/deep-health-agent.ts`).
  That orchestrator runs three **dynamic subagents** — `posture-analyst`,
  `body-composition-analyst`, `recovery-strategist` — fanned out concurrently
  through `@langchain/quickjs`'s in-agent `eval`/`task()` interpreter, per the
  [Deep Agents dynamic-subagents pattern](https://docs.langchain.com/oss/javascript/deepagents/dynamic-subagents).
- `POST /api/routine-visuals` — for each routine exercise, generates a Nano
  Banana (`gemini-2.5-flash-image`) instructional visual and, in parallel,
  looks up a real YouTube tutorial via the [Exa](https://exa.ai) search API
  (`src/lib/exa.ts`, scoped to `youtube.com`). Partial failures degrade
  per-exercise (missing image/video) instead of failing the batch.
- `POST /api/chat` — chat with the coach. Stateless per turn: the client
  sends the full message history plus the current report JSON as
  `systemInstruction` context, so answers reference actual readiness/posture/
  routine data instead of generic advice.
- `POST /api/visual` — Nano Banana dashboard-visual generation via
  `@google/genai`'s Interactions API, optionally conditioned on a captured
  photo.
- `GET /api/status` — reports whether Gemini is configured, which models are
  resolved, and whether browser automation is live.
- `src/lib/browser-tool.ts` — a LangChain tool (`web_evidence_search`) that
  shells out to Vercel's `agent-browser` CLI so subagents can ground guidance
  in live pages. Off by default (see below).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY
npm run dev
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

### Model availability caveat

Google restricts brand-new API keys/projects from calling some legacy 2.x
models (`gemini-2.5-flash`, `gemini-2.0-flash`, …) via `generateContent` —
you'll see `"... is no longer available to new users"` even though the model
still shows up in `ListModels`. The app defaults to the exact models
requested (`gemini-2.5-flash` / `gemini-2.5-flash-image`) but every model id
is env-overridable with zero code changes:

```bash
GEMINI_TEXT_MODEL=gemini-flash-latest      # or gemini-3.1-flash-lite, etc.
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image  # Nano Banana works fine on new keys
```

### Exercise videos (Exa)

Get a key from the [Exa dashboard](https://dashboard.exa.ai/api-keys) and set
`EXA_API_KEY`. Optional — without it, `/api/routine-visuals` still generates
exercise images, it just skips the "Watch on YouTube" link per card.

## Live web evidence (agent-browser)

`ENABLE_AGENT_BROWSER=false` by default: Vercel functions are ephemeral, and
`agent-browser` needs a real Chrome binary. To enable:

- **Locally**: `npm install -g agent-browser && agent-browser install`, then
  set `ENABLE_AGENT_BROWSER=true`.
- **On Vercel**: set `ENABLE_AGENT_BROWSER=true`. The server resolves a
  Chromium binary at request time via `@sparticuz/chromium` automatically
  (detected through `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`); no extra setup, but
  cold starts get slower and you should raise `maxDuration` accordingly.

If disabled or a page fails to load, the tool returns a clear "not verified
live" message instead of failing the run — subagents fall back to general
knowledge and disclose that explicitly.

## Deploying to Vercel

1. Push this repo, import it in Vercel.
2. Set `GEMINI_API_KEY` (and any overrides above) in Project Settings →
   Environment Variables.
3. `vercel.json` sets `maxDuration: 120` for `/api/analyze` (the deep-agent
   workflow needs it), `90` for `/api/routine-visuals` (parallel Nano Banana +
   Exa calls per exercise), and `60` for `/api/visual` — all require a plan
   that allows >60s functions (Vercel Pro+). On Hobby, either upgrade or set
   `DEEP_AGENT_TIMEOUT_MS=35000` so the deep-agent step fails over to the
   primary report well inside the 60s Hobby cap instead of timing out the
   whole function.
4. Deploy.

## Notes on the deep-agent budget

`DEEP_AGENT_TIMEOUT_MS` (default 90000) bounds the dynamic-subagent workflow.
If it's exceeded, `/api/analyze` still returns 200 with the primary vision
report and `agentStatus: "fallback"` — the UI never hard-fails just because
the coaching brief ran long.
