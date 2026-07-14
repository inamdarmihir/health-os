"use client";

import { useEffect, useRef, useState } from "react";
import { generateId } from "../lib/id";
import type {
  CoachChatMessage,
  CoachJointDraft,
  CoachMealLogDraft,
  CoachProfile,
  CoachState,
  CoachWalkSpotDraft,
  ExerciseSuggestion,
  FoodSpotSuggestion,
  WalkSpotSuggestion,
} from "../lib/coach-types";

// ─── Local display types ──────────────────────────────────────────────────────

/** Exercise suggestion tagged with a client-side id so its Nano Banana visual can be tracked. */
type DisplayExercise = ExerciseSuggestion & { id: string };

type Suggestions = {
  exercises: DisplayExercise[];
  foodSpots: FoodSpotSuggestion[];
  walkSpots: WalkSpotSuggestion[];
};

// DisplayMessage is local-only; suggestions never round-trip back to the API.
type DisplayMessage = CoachChatMessage & { suggestions?: Suggestions };

type VisualState = "loading" | "error" | { mimeType: string; data: string };

type Props = {
  state: CoachState;
  onProfileUpdates: (updates: Partial<CoachProfile>) => void;
  onLogMeal: (draft: CoachMealLogDraft) => void;
  onSaveJoint: (draft: CoachJointDraft) => void;
  onSaveWalkSpot: (draft: CoachWalkSpotDraft) => void;
  onRunMealPlan: () => void;
  mealPlanLoading: boolean;
};

function cuisineEmoji(cuisine?: string) {
  const c = (cuisine || "").toLowerCase();
  if (c.includes("biryani") || c.includes("rice")) return "🍚";
  if (c.includes("south indian")) return "🥘";
  if (c.includes("north indian") || c.includes("punjabi")) return "🍛";
  if (c.includes("chinese") || c.includes("asian")) return "🥡";
  if (c.includes("pizza") || c.includes("italian")) return "🍕";
  if (c.includes("cafe") || c.includes("continental") || c.includes("coffee")) return "☕";
  if (c.includes("bakery") || c.includes("dessert") || c.includes("sweet")) return "🍰";
  if (c.includes("salad") || c.includes("healthy")) return "🥗";
  return "🍽️";
}

// ─── Carousel sub-components ──────────────────────────────────────────────────

function ExerciseCarousel({ exercises, visuals }: { exercises: DisplayExercise[]; visuals: Record<string, VisualState> }) {
  if (exercises.length === 0) return null;
  return (
    <div className="carousel">
      <div className="carousel-header">
        <span className="carousel-icon">💪</span>
        <span className="carousel-title">Exercises for you</span>
      </div>
      <div className="carousel-track">
        {exercises.map((ex) => {
          const visual = visuals[ex.id];
          const href = ex.videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.searchQuery)}`;
          return (
            <a key={ex.id} className="ex-card" href={href} target="_blank" rel="noreferrer">
              {!visual || visual === "loading" ? (
                <div className="ex-media skeleton" />
              ) : visual === "error" ? (
                <div className="ex-media placeholder">🏋️</div>
              ) : (
                <img className="ex-media" src={`data:${visual.mimeType};base64,${visual.data}`} alt={ex.name} />
              )}
              <div className="ex-card-body">
                <div className="ex-card-name">{ex.name}</div>
                <div className="ex-card-sets">{ex.sets}</div>
                <p className="ex-card-reason">{ex.reason}</p>
                <span className="ex-card-cta">▶ Watch tutorial</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function FoodCarousel({
  spots,
  onSave,
  savedNames,
}: {
  spots: FoodSpotSuggestion[];
  onSave: (s: FoodSpotSuggestion) => void;
  savedNames: Set<string>;
}) {
  if (spots.length === 0) return null;
  return (
    <div className="carousel">
      <div className="carousel-header">
        <span className="carousel-icon">🍽️</span>
        <span className="carousel-title">Food spots near you</span>
      </div>
      <div className="carousel-track">
        {spots.map((s, i) => {
          const saved = savedNames.has(s.name.toLowerCase());
          return (
            <div key={i} className="spot-card">
              <div className="spot-card-header">{cuisineEmoji(s.cuisine)}</div>
              <button
                type="button"
                className={`spot-save-btn${saved ? " saved" : ""}`}
                disabled={saved}
                onClick={() => onSave(s)}
                aria-label={saved ? "Saved" : "Save to your joints"}
              >
                {saved ? "✓" : "♡"}
              </button>
              <div className="spot-card-body">
                <div className="spot-card-name">{s.name}</div>
                {s.cuisine && <div className="spot-card-meta">{s.cuisine}</div>}
                <p className="spot-card-reason">{s.reason}</p>
                {s.url && (
                  <a className="spot-card-link" href={s.url} target="_blank" rel="noreferrer">
                    View menu →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WalkCarousel({
  spots,
  onSave,
  savedNames,
}: {
  spots: WalkSpotSuggestion[];
  onSave: (s: WalkSpotSuggestion) => void;
  savedNames: Set<string>;
}) {
  if (spots.length === 0) return null;
  return (
    <div className="carousel">
      <div className="carousel-header">
        <span className="carousel-icon">🚶</span>
        <span className="carousel-title">Walk spots</span>
      </div>
      <div className="carousel-track">
        {spots.map((s, i) => {
          const saved = savedNames.has(s.name.toLowerCase());
          return (
            <div key={i} className="spot-card">
              <div className="spot-card-header">🌳</div>
              <button
                type="button"
                className={`spot-save-btn${saved ? " saved" : ""}`}
                disabled={saved}
                onClick={() => onSave(s)}
                aria-label={saved ? "Saved" : "Save walk spot"}
              >
                {saved ? "✓" : "♡"}
              </button>
              <div className="spot-card-body">
                <div className="spot-card-name">{s.name}</div>
                <div className="spot-card-meta">{s.timing}</div>
                <p className="spot-card-reason">{s.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CoachChat({
  state,
  onProfileUpdates,
  onLogMeal,
  onSaveJoint,
  onSaveWalkSpot,
  onRunMealPlan,
  mealPlanLoading,
}: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyForMealPlan, setReadyForMealPlan] = useState(false);
  const [visuals, setVisuals] = useState<Record<string, VisualState>>({});
  // Track saved names locally so "Save" buttons flip to a checkmark instantly.
  const [savedJointNames, setSavedJointNames] = useState<Set<string>>(
    () => new Set(state.joints.map((j) => j.name.toLowerCase())),
  );
  const [savedWalkNames, setSavedWalkNames] = useState<Set<string>>(
    () => new Set(state.walkSpots.map((w) => w.name.toLowerCase())),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, sending]);

  function toApiMessages(display: DisplayMessage[]): CoachChatMessage[] {
    return display.map(({ role, content }) => ({ role, content }));
  }

  async function fetchExerciseVisuals(exercises: DisplayExercise[]) {
    setVisuals((prev) => {
      const next = { ...prev };
      for (const ex of exercises) next[ex.id] = "loading";
      return next;
    });
    try {
      const response = await fetch("/api/suggestion-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises: exercises.map((ex) => ({ id: ex.id, name: ex.name })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Visual generation failed.");
      setVisuals((prev) => {
        const next = { ...prev };
        for (const img of (payload.images ?? []) as { id: string; mimeType: string; data: string }[]) {
          next[img.id] = { mimeType: img.mimeType, data: img.data };
        }
        for (const ex of exercises) if (next[ex.id] === "loading") next[ex.id] = "error";
        return next;
      });
    } catch {
      setVisuals((prev) => {
        const next = { ...prev };
        for (const ex of exercises) next[ex.id] = "error";
        return next;
      });
    }
  }

  async function sendTurn(nextDisplay: DisplayMessage[]) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, messages: toApiMessages(nextDisplay) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Coach chat failed.");

      if (payload.profileUpdates) onProfileUpdates(payload.profileUpdates);
      if (payload.logMeal) onLogMeal(payload.logMeal);
      if (payload.saveJoint) onSaveJoint(payload.saveJoint);
      if (payload.saveWalkSpot) onSaveWalkSpot(payload.saveWalkSpot);
      if (payload.readyForMealPlan !== undefined) setReadyForMealPlan(Boolean(payload.readyForMealPlan));

      const exercisesWithIds: DisplayExercise[] = ((payload.suggestExercises ?? []) as ExerciseSuggestion[]).map((ex) => ({
        ...ex,
        id: generateId(),
      }));
      const suggestions: Suggestions = {
        exercises: exercisesWithIds,
        foodSpots: (payload.suggestFoodSpots ?? []) as FoodSpotSuggestion[],
        walkSpots: (payload.suggestWalkSpots ?? []) as WalkSpotSuggestion[],
      };
      const hasSuggestions =
        suggestions.exercises.length > 0 || suggestions.foodSpots.length > 0 || suggestions.walkSpots.length > 0;

      const coachMessage: DisplayMessage = {
        role: "coach",
        content: payload.reply as string,
        suggestions: hasSuggestions ? suggestions : undefined,
      };
      setMessages([...nextDisplay, coachMessage]);

      if (exercisesWithIds.length > 0) void fetchExerciseVisuals(exercisesWithIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach chat failed.");
    } finally {
      setSending(false);
    }
  }

  function startConversation() {
    if (started || sending) return;
    setStarted(true);
    const opening: DisplayMessage[] = [{ role: "user", content: "Hi, let's get started." }];
    setMessages(opening);
    void sendTurn(opening);
  }

  function send() {
    const content = draft.trim();
    if (!content || sending || !started) return;
    const nextMessages: DisplayMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    void sendTurn(nextMessages);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function saveJoint(s: FoodSpotSuggestion) {
    onSaveJoint({ name: s.name, area: s.area, cuisine: s.cuisine });
    setSavedJointNames((prev) => new Set([...prev, s.name.toLowerCase()]));
  }

  function saveWalkSpot(s: WalkSpotSuggestion) {
    onSaveWalkSpot({ name: s.name, area: s.area });
    setSavedWalkNames((prev) => new Set([...prev, s.name.toLowerCase()]));
  }

  return (
    <div className="coach-shell">
      <header className="coach-header">
        <span className="coach-logo">✦</span>
        <div>
          <div className="coach-title">AI Health Coach</div>
          <div className="coach-subtitle">Fitness · Food · Recovery</div>
        </div>
      </header>

      <div className="coach-messages" ref={listRef}>
        {messages.length === 0 && !sending && (
          <div className="coach-welcome">
            <div className="coach-welcome-icon">✦</div>
            <p className="coach-welcome-text">
              Your personal AI coach for health, fitness, and food. Tell me your goals — I'll handle the rest.
            </p>
            <button type="button" className="primary coach-start-btn" onClick={startConversation}>
              Start conversation
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            <div className={`bubble ${msg.role}`}>{msg.content}</div>
            {msg.role === "coach" && msg.suggestions && (
              <>
                <ExerciseCarousel exercises={msg.suggestions.exercises} visuals={visuals} />
                <FoodCarousel spots={msg.suggestions.foodSpots} onSave={saveJoint} savedNames={savedJointNames} />
                <WalkCarousel spots={msg.suggestions.walkSpots} onSave={saveWalkSpot} savedNames={savedWalkNames} />
              </>
            )}
          </div>
        ))}

        {sending && (
          <div className="msg-row coach">
            <div className="bubble coach typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
      </div>

      {readyForMealPlan && (
        <div className="coach-actions">
          <button type="button" className="secondary" disabled={mealPlanLoading} onClick={onRunMealPlan}>
            {mealPlanLoading ? "Planning…" : "🍱 Generate meal plan"}
          </button>
        </div>
      )}

      {error && <div className="coach-error">{error}</div>}

      <div className="coach-input-bar">
        <input
          ref={inputRef}
          type="text"
          className="coach-input"
          value={draft}
          placeholder={started ? "Message your coach…" : "Tap 'Start conversation' above"}
          disabled={!started || sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck
        />
        <button
          type="button"
          className="primary coach-send-btn"
          disabled={!started || sending || !draft.trim()}
          onClick={send}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
