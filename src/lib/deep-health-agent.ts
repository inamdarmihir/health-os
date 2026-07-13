import { createDeepAgent, type SubAgent } from "deepagents";
import { createCodeInterpreterMiddleware } from "@langchain/quickjs";
import { HumanMessage } from "@langchain/core/messages";
import { browserAutomationEnabled, webEvidenceSearchTool } from "./browser-tool";
import { formatMetricContext } from "./local-metrics";
import { activeProvider, intelligenceConfigured, resolveIntelligenceModel } from "./ai";
import type { HealthOsReport, HealthProfile, LocalMetricEstimate } from "./health-types";

const AGENT_TIMEOUT_MS = Number(process.env.DEEP_AGENT_TIMEOUT_MS) || 90_000;

const domainSubagents: SubAgent[] = [
  {
    name: "posture-analyst",
    description: "Deepens posture findings into a corrective-exercise protocol with rationale.",
    systemPrompt: "You are a movement and posture coach. Given posture findings and likely drivers, produce a prioritized, evidence-informed corrective protocol (mobility, strengthening, cueing) with rep/set/frequency guidance. Never diagnose a spinal or neurological condition; flag red-flag findings (numbness, radiating pain, sudden asymmetry) for clinician referral instead of prescribing exercise.",
    tools: [webEvidenceSearchTool]
  },
  {
    name: "body-composition-analyst",
    description: "Refines body composition estimate and nutrition/training levers using visual + measurement signals.",
    systemPrompt: "You are a body-composition coach. Given visual signals, measurement estimates (BMI, navy body-fat %, waist-to-height ratio), the daily-steps activity level, and the user's goal, explain the estimate's confidence, the main levers (caloric balance, protein, resistance training, daily steps target, sleep) and concrete weekly targets. State explicitly that visual and formula-based estimates are approximations, not DEXA-grade measurements.",
    tools: [webEvidenceSearchTool]
  },
  {
    name: "recovery-strategist",
    description: "Turns facial recovery signals and profile context into a sleep/stress/HRV-style recovery plan.",
    systemPrompt: "You are a recovery and readiness coach in the style of WHOOP/Oura. Given facial recovery/inflammation signals, daily-steps activity level, and user-reported recovery/constraints, produce a readiness narrative and a recovery protocol (sleep, stress, hydration, deload guidance, and how daily activity should adjust for the coming week). Do not diagnose dermatological or endocrine disease; recommend clinician follow-up for signals suggesting one.",
    tools: [webEvidenceSearchTool]
  }
];

const AGENT_SYSTEM_PROMPT = [
  "You are the AI Health OS orchestrator, a personalized health-intelligence supervisor in the spirit of WHOOP/Oura coaching, operating over a vision-model report that already analyzed the user's face, body, and posture photos.",
  "You never diagnose disease and always add a clinician-referral note for concerning findings.",
  "Workflow: write a short todo plan, then run a dynamic-subagent workflow that fans out to posture-analyst, body-composition-analyst, and recovery-strategist in parallel using the eval tool's task() dispatcher (this is a 'workflow' — dispatch all three concurrently with Promise.all inside eval, then synthesize).",
  "If web_evidence_search is available to a subagent and useful, use it sparingly to ground guidance (e.g. ACSM, CDC, sleep-science sources); if it reports being disabled, proceed on general knowledge and say evidence was not live-verified.",
  "Finish with a single markdown brief titled 'Deep Agent Coaching Brief' containing sections: Posture Protocol, Body Composition Levers, Recovery Plan, and Watch-outs. Keep it tight (under 350 words) and actionable."
].join(" ");

export type DeepAgentResult = {
  agentBrief: string;
  status: "completed" | "fallback" | "disabled";
};

export async function runHealthDeepAgent(profile: HealthProfile, metrics: LocalMetricEstimate, visionReport: HealthOsReport): Promise<DeepAgentResult> {
  if (!intelligenceConfigured()) {
    return { agentBrief: "", status: "disabled" };
  }

  try {
    const taskPrompt = [
      "Vision-model report (already generated from the user's photos):",
      JSON.stringify(visionReport, null, 2),
      "",
      "User profile:",
      JSON.stringify(profile, null, 2),
      "",
      "Deterministic local metrics:",
      formatMetricContext(metrics) || "none",
      "",
      browserAutomationEnabled()
        ? "Live browser evidence search is enabled."
        : "Live browser evidence search is currently disabled in this deployment; reason from general knowledge and disclose that."
    ].join("\n");

    const modelPrefix = activeProvider() === "openai" ? "openai" : "google-genai";
    const agent = createDeepAgent({
      model: `${modelPrefix}:${resolveIntelligenceModel()}`,
      systemPrompt: AGENT_SYSTEM_PROMPT,
      subagents: domainSubagents,
      tools: [webEvidenceSearchTool],
      middleware: [createCodeInterpreterMiddleware({ ptc: ["web_evidence_search"] })]
    });

    const invocation = agent.invoke({
      messages: [new HumanMessage(taskPrompt)]
    });

    const { promise: timeout, reject: rejectTimeout } = Promise.withResolvers<never>();
    const timeoutHandle = setTimeout(() => rejectTimeout(new Error("deep-agent-timeout")), AGENT_TIMEOUT_MS);

    const result = (await Promise.race([invocation, timeout]).finally(() => clearTimeout(timeoutHandle))) as Awaited<typeof invocation>;
    const finalMessage = result.messages.at(-1);
    const content = typeof finalMessage?.content === "string"
      ? finalMessage.content
      : JSON.stringify(finalMessage?.content ?? "");

    return { agentBrief: content || "Deep agent returned no content.", status: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { agentBrief: `Deep agent orchestration unavailable this run (${message}). Serving the primary vision-model report only.`, status: "fallback" };
  }
}
