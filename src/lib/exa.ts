import type { ExerciseVideo, ReferenceArticle } from "./health-types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const MAX_REFERENCE_TOPICS = 4;

export function exaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

export async function findExerciseVideos(exercises: { id: string; name: string; category: string }[]): Promise<ExerciseVideo[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const settled = await Promise.allSettled(
    exercises.map(async (exercise) => {
      const response = await fetch(EXA_SEARCH_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${exercise.name} ${exercise.category} exercise proper form tutorial`,
          type: "fast",
          numResults: 1,
          includeDomains: ["youtube.com"]
        })
      });
      if (!response.ok) throw new Error(`Exa search failed (${response.status})`);
      const json = (await response.json()) as { results?: { url?: string; title?: string }[] };
      const top = json.results?.[0];
      if (!top?.url) throw new Error("No video result for " + exercise.name);
      return { id: exercise.id, title: top.title || exercise.name, url: top.url } satisfies ExerciseVideo;
    })
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<ExerciseVideo> => result.status === "fulfilled")
    .map((result) => result.value);
}

export async function findReferenceArticles(topics: string[]): Promise<ReferenceArticle[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const settled = await Promise.allSettled(
    topics.slice(0, MAX_REFERENCE_TOPICS).map(async (topic) => {
      const response = await fetch(EXA_SEARCH_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: topic,
          type: "neural",
          numResults: 1,
          excludeDomains: ["youtube.com"]
        })
      });
      if (!response.ok) throw new Error(`Exa search failed (${response.status})`);
      const json = (await response.json()) as { results?: { url?: string; title?: string }[] };
      const top = json.results?.[0];
      if (!top?.url) throw new Error("No reference result for " + topic);
      return { topic, title: top.title || topic, url: top.url } satisfies ReferenceArticle;
    })
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<ReferenceArticle> => result.status === "fulfilled")
    .map((result) => result.value);
}
