export function extractJson(text: string, finishReason?: string) {
  const trimmed = text.trim();
  const truncated = finishReason && finishReason !== "STOP";
  const truncationHint = truncated
    ? ` Gemini stopped early (finishReason=${finishReason}); the response was likely cut off before the JSON closed. Try again or raise maxOutputTokens.`
    : "";
  try {
    if (trimmed.startsWith("{")) return JSON.parse(trimmed);
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error("Model did not return JSON." + truncationHint);
  } catch (error) {
    if (!truncated) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${truncationHint}`);
  }
}
