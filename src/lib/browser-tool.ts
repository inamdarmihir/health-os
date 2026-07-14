import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "langchain";
import { z } from "zod";
import chromium from "@sparticuz/chromium";

const execFileAsync = promisify(execFile);

const BROWSER_TIMEOUT_MS = 45_000;

export function browserAutomationEnabled() {
  return process.env.ENABLE_AGENT_BROWSER === "true";
}

let cachedServerlessChromiumPath: string | undefined;

async function resolveExecutablePath() {
  if (process.env.AGENT_BROWSER_EXECUTABLE_PATH) return process.env.AGENT_BROWSER_EXECUTABLE_PATH;
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) return undefined;
  cachedServerlessChromiumPath ??= await chromium.executablePath();
  return cachedServerlessChromiumPath;
}

async function runAgentBrowser(args: string[]) {
  const bin = process.env.AGENT_BROWSER_BIN || "agent-browser";
  const env = { ...process.env };
  const executablePath = await resolveExecutablePath();
  if (executablePath) env.AGENT_BROWSER_EXECUTABLE_PATH = executablePath;
  const { stdout, stderr } = await execFileAsync(bin, args, { timeout: BROWSER_TIMEOUT_MS, env });
  return stdout.trim() || stderr.trim();
}

export async function snapshotUrl(url: string, goal: string): Promise<{ ok: boolean; text: string }> {
  if (!browserAutomationEnabled()) {
    return {
      ok: false,
      text: "agent-browser is disabled in this deployment (set ENABLE_AGENT_BROWSER=true and provision Chrome for Testing to enable live browsing). Reason this over general knowledge instead."
    };
  }
  try {
    await runAgentBrowser(["open", url]);
    const snapshot = await runAgentBrowser(["snapshot"]);
    return { ok: true, text: `Goal: ${goal}\nSnapshot of ${url}:\n${snapshot.slice(0, 6000)}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      text: `agent-browser navigation failed for ${url}: ${message}. Fall back to general medical/fitness knowledge and say the source could not be verified live.`
    };
  }
}

export const webEvidenceSearchTool = tool(
  async ({ url, goal }: { url: string; goal: string }) => {
    const result = await snapshotUrl(url, goal);
    return result.text;
  },
  {
    name: "web_evidence_search",
    description: "Open a URL with agent-browser (real Chrome via Chrome for Testing) and return an accessibility snapshot as evidence for health/fitness claims. Use for citing current guidance (e.g. ACSM, CDC, peer-reviewed sources) relevant to the user's report.",
    schema: z.object({
      url: z.string().describe("Full URL of a reputable health/fitness source to inspect"),
      goal: z.string().describe("What fact or guidance you are trying to confirm on this page")
    })
  }
);
