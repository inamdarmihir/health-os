import type { FoodJoint, FoodProfile, FoodSearchHit } from "./food-types";

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
