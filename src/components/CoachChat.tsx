"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Suggestions = {
  exercises: ExerciseSuggestion[];
  foodSpots: FoodSpotSuggestion[];
  walkSpots: WalkSpotSuggestion[];
};

// DisplayMessage is local-only; suggestions are stripped before being sent to the API.
type DisplayMessage = CoachChatMessage & { suggestions?: Suggestions };

type Props = {
  state: CoachState;
  onProfileUpdates: (updates: Partial<CoachProfile>) => void;
  onLogMeal: (draft: CoachMealLogDraft) => void;
  onSaveJoint: (draft: CoachJointDraft) => void;
  onSaveWalkSpot: (draft: CoachWalkSpotDraft) => void;
  onRunMealPlan: () => void;
  mealPlanLoading: boolean;
};

// ─── Suggestion card sub-components ──────────────────────────────────────────

function ExerciseCards({
  exercises,
}: {
  exercises: ExerciseSuggestion[];
}) {
  if (exercises.length === 0) return null;
  return (
    <div className="sugg-group">
      <div className="sugg-label">💪 Exercises for you</div>
      {exercises.map((ex, i) => (
        <div key={i} className="sugg-card">
          <div className="sugg-card-top">
            <span className="sugg-name">{ex.name}</span>
            <span className="sugg-meta">{ex.sets}</span>
          </div>
          <p className="sugg-reason">{ex.reason}</p>
          {ex.videoUrl ? (
            <a
              className="sugg-action-link"
              href={ex.videoUrl}
              target="_blank"
              rel="noreferrer"
            >
              ▶ Watch tutorial
            </a>
          ) : (
            <a
              className="sugg-action-link muted"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.searchQuery)}`}
              target="_blank"
              rel="noreferrer"
            >
              Search on YouTube
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function FoodSpotCards({
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
    <div className="sugg-group">
      <div className="sugg-label">🍽 Food spots near you</div>
      {spots.map((s, i) => {
        const alreadySaved = savedNames.has(s.name.toLowerCase());
        return (
          <div key={i} className="sugg-card">
            <div className="sugg-card-top">
              <span className="sugg-name">{s.name}</span>
              {s.cuisine && <span className="sugg-meta">{s.cuisine}</span>}
            </div>
            <p className="sugg-reason">{s.reason}</p>
            <div className="sugg-card-actions">
              {s.url && (
                <a className="sugg-action-link" href={s.url} target="_blank" rel="noreferrer">
                  View on Swiggy/Zomato
                </a>
              )}
              <button
                type="button"
                className="sugg-save-btn"
                disabled={alreadySaved}
                onClick={() => onSave(s)}
              >
                {alreadySaved ? "Saved ✓" : "+ Save"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WalkSpotCards({
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
    <div className="sugg-group">
      <div className="sugg-label">🚶 Walk spots</div>
      {spots.map((s, i) => {
        const alreadySaved = savedNames.has(s.name.toLowerCase());
        return (
          <div key={i} className="sugg-card">
            <div className="sugg-card-top">
              <span className="sugg-name">{s.name}</span>
              <span className="sugg-meta">{s.timing}</span>
            </div>
            <p className="sugg-reason">{s.reason}</p>
            <button
              type="button"
              className="sugg-save-btn"
              disabled={alreadySaved}
              onClick={() => onSave(s)}
            >
              {alreadySaved ? "Saved ✓" : "+ Save"}
            </button>
          </div>
        );
      })}
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
  // Track saved names locally so "Save" buttons toggle to "Saved ✓" instantly.
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

  // Wire messages → API: strip suggestions (display-only) before sending
  function toApiMessages(display: DisplayMessage[]): CoachChatMessage[] {
    return display.map(({ role, content }) => ({ role, content }));
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

      const suggestions: Suggestions = {
        exercises: payload.suggestExercises ?? [],
        foodSpots: payload.suggestFoodSpots ?? [],
        walkSpots: payload.suggestWalkSpots ?? [],
      };
      const hasSuggestions =
        suggestions.exercises.length > 0 ||
        suggestions.foodSpots.length > 0 ||
        suggestions.walkSpots.length > 0;

      const coachMessage: DisplayMessage = {
        role: "coach",
        content: payload.reply as string,
        suggestions: hasSuggestions ? suggestions : undefined,
      };
      setMessages([...nextDisplay, coachMessage]);
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
        <span className="coach-title">AI Health Coach</span>
      </header>

      <div className="coach-messages" ref={listRef}>
        {messages.length === 0 && !sending && (
          <div className="coach-welcome">
            <p className="coach-welcome-text">
              Your personal AI coach for health, fitness, and food. Tell me your goals — I'll handle the rest.
            </p>
            <button type="button" className="primary coach-start-btn" onClick={startConversation}>
              Start conversation
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`bubble ${msg.role}`}>{msg.content}</div>
            {msg.role === "coach" && msg.suggestions && (
              <div className="sugg-tray">
                <ExerciseCards exercises={msg.suggestions.exercises} />
                <FoodSpotCards
                  spots={msg.suggestions.foodSpots}
                  onSave={saveJoint}
                  savedNames={savedJointNames}
                />
                <WalkSpotCards
                  spots={msg.suggestions.walkSpots}
                  onSave={saveWalkSpot}
                  savedNames={savedWalkNames}
                />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="bubble coach typing">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
      </div>

      {readyForMealPlan && (
        <div className="coach-actions">
          <button
            type="button"
            className="secondary"
            disabled={mealPlanLoading}
            onClick={onRunMealPlan}
          >
            {mealPlanLoading ? "Planning…" : "Generate meal plan"}
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
