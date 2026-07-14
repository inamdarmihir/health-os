import type { DiscoveredFoodOutlet, FoodJoint, FoodProfile, FoodSearchHit } from "./food-types";
import { browserAutomationEnabled, snapshotUrl } from "./browser-tool";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const MAX_JOINTS_SEARCHED = 6;

type ExaResult = { url?: string; title?: string; text?: string };

async function exaSearch(apiKey: string, query: string, numResults: number): Promise<ExaResult[]> {
  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults,
      includeDomains: ["swiggy.com", "zomato.com"],
      contents: { text: { maxCharacters: 400 } }
    })
  });
  if (!response.ok) throw new Error(`Exa search failed (${response.status})`);
  const json = (await response.json()) as { results?: ExaResult[] };
  return json.results ?? [];
}

/**
 * Grounds meal-plan generation in live-ish Swiggy/Zomato search evidence: per saved
 * joint (menu/price/delivery presence near the user) plus a general "nearby, in
 * budget" discovery pass. Exa is neural/web search, not the Swiggy/Zomato APIs
 * (neither publishes a public ordering API) — this is best-effort grounding, not a
 * live cart. Degrades to [] (and the prompt says so) when EXA_API_KEY is unset.
 */
export async function findNearbyFoodEvidence(profile: FoodProfile, joints: FoodJoint[]): Promise<FoodSearchHit[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const area = profile.homeLocation || profile.city || "";
  const targetJoints = joints.slice(0, MAX_JOINTS_SEARCHED);

  const perJointSettled = await Promise.allSettled(
    targetJoints.map(async (joint) => {
      const query = `${joint.name} ${joint.area || area} menu price delivery`;
      const results = await exaSearch(apiKey, query, 2);
      return results
        .filter((r): r is ExaResult & { url: string } => Boolean(r.url))
        .map((r) => ({ jointName: joint.name, title: r.title || joint.name, url: r.url, snippet: r.text } satisfies FoodSearchHit));
    })
  );

  const hits = perJointSettled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  if (area) {
    try {
      const budgetHint = `under ${profile.budgetMaxRs || 700} rupees`;
      const general = await exaSearch(apiKey, `food delivery restaurants near ${area} ${budgetHint}`, 3);
      hits.push(
        ...general
          .filter((r): r is ExaResult & { url: string } => Boolean(r.url))
          .map((r) => ({ jointName: "Nearby (discovered)", title: r.title || "Nearby option", url: r.url, snippet: r.text } satisfies FoodSearchHit))
      );
    } catch {
      // Non-fatal: general discovery is a bonus signal, per-joint evidence already gathered.
    }
  }

  return hits;
}

/**
 * Surfaces outlets beyond the user's saved joints — genuinely new spots near them,
 * optionally verified live via agent-browser when enabled. Best-effort: silently
 * degrades to [] when EXA_API_KEY or a location is missing, same as
 * findNearbyFoodEvidence.
 */
export async function discoverNewFoodOutlets(profile: FoodProfile, joints: FoodJoint[]): Promise<DiscoveredFoodOutlet[]> {
  const apiKey = process.env.EXA_API_KEY;
  const location = profile.homeLocation || profile.city || profile.workLocation || "";
  if (!apiKey || !location) return [];

  const results = await exaSearch(
    apiKey,
    `new food outlets restaurants near ${location} not on Swiggy Zomato hidden gems`,
    8
  ).catch(() => [] as ExaResult[]);

  const knownNames = joints.map((joint) => joint.name.toLowerCase()).filter(Boolean);
  const isKnown = (candidate: ExaResult) => {
    const haystacks = [candidate.title, candidate.url]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase());
    return knownNames.some((name) => haystacks.some((h) => h.includes(name) || name.includes(h)));
  };

  const candidates = results.filter((r): r is ExaResult & { url: string } => Boolean(r.url) && !isKnown(r)).slice(0, 3);

  const useBrowser = browserAutomationEnabled();
  return Promise.all(
    candidates.map(async (candidate) => {
      const name = candidate.title || candidate.url;
      const verifiedLive = useBrowser ? (await snapshotUrl(candidate.url, `Verify menu/price info for ${name}`)).ok : false;
      return {
        name,
        area: location,
        cuisine: undefined,
        url: candidate.url,
        snippet: candidate.text?.slice(0, 300),
        verifiedLive
      } satisfies DiscoveredFoodOutlet;
    })
  );
}
