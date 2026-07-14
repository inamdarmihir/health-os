// Models occasionally emit near-valid JSON: a bare newline/tab inside a string
// literal, or a trailing comma before a closing brace/bracket. Repair those
// specific cases before giving up, rather than failing on an otherwise-usable payload.
function repairJson(candidate: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const char of candidate) {
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else if (char === "\\") {
        result += char;
        escaped = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        result += char;
      }
    } else if (char === '"') {
      inString = true;
      result += char;
    } else {
      result += char;
    }
  }
  return result.replace(/,(\s*[}\]])/g, "$1");
}

function tryParse(candidate: string): { ok: true; value: unknown } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (error) {
    try {
      return { ok: true, value: JSON.parse(repairJson(candidate)) };
    } catch {
      return { ok: false, error };
    }
  }
}

export function extractJson(text: string, finishReason?: string) {
  const trimmed = text.trim();
  const truncated = finishReason && finishReason !== "STOP";
  const truncationHint = truncated
    ? ` Gemini stopped early (finishReason=${finishReason}); the response was likely cut off before the JSON closed. Try again or raise maxOutputTokens.`
    : "";
  try {
    if (trimmed.startsWith("{")) {
      const result = tryParse(trimmed);
      if (result.ok) return result.value;
      throw result.error;
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const result = tryParse(fenced[1]);
      if (result.ok) return result.value;
      throw result.error;
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const result = tryParse(trimmed.slice(first, last + 1));
      if (result.ok) return result.value;
      throw result.error;
    }
    throw new Error("Model did not return JSON." + truncationHint);
  } catch (error) {
    if (!truncated) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${truncationHint}`);
  }
}
