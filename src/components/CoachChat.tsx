"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CoachAttachment,
  CoachChatMessage,
  CoachJointDraft,
  CoachMealLogDraft,
  CoachProfile,
  CoachState,
  CoachWalkSpotDraft,
} from "../lib/coach-types";

type Props = {
  state: CoachState;
  onProfileUpdates: (updates: Partial<CoachProfile>) => void;
  onPhotoCaptured: (attachment: CoachAttachment) => void;
  onLogMeal: (draft: CoachMealLogDraft) => void;
  onSaveJoint: (draft: CoachJointDraft) => void;
  onSaveWalkSpot: (draft: CoachWalkSpotDraft) => void;
  onRunAnalysis: () => void;
  onRunMealPlan: () => void;
  analysisLoading: boolean;
  mealPlanLoading: boolean;
};

export function CoachChat({
  state,
  onProfileUpdates,
  onLogMeal,
  onSaveJoint,
  onSaveWalkSpot,
  onRunAnalysis,
  onRunMealPlan,
  analysisLoading,
  mealPlanLoading,
}: Props) {
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyForAnalysis, setReadyForAnalysis] = useState(false);
  const [readyForMealPlan, setReadyForMealPlan] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  useEffect(scrollToBottom, [messages, sending]);

  async function sendTurn(nextMessages: CoachChatMessage[]) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, messages: nextMessages }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Coach chat failed.");

      if (payload.profileUpdates) onProfileUpdates(payload.profileUpdates);
      if (payload.logMeal) onLogMeal(payload.logMeal);
      if (payload.saveJoint) onSaveJoint(payload.saveJoint);
      if (payload.saveWalkSpot) onSaveWalkSpot(payload.saveWalkSpot);
      if (payload.readyForAnalysis !== undefined) setReadyForAnalysis(Boolean(payload.readyForAnalysis));
      if (payload.readyForMealPlan !== undefined) setReadyForMealPlan(Boolean(payload.readyForMealPlan));

      setMessages([...nextMessages, { role: "coach", content: payload.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach chat failed.");
    } finally {
      setSending(false);
    }
  }

  function startConversation() {
    if (started || sending) return;
    setStarted(true);
    const opening: CoachChatMessage[] = [{ role: "user", content: "Hi, let's get started." }];
    setMessages(opening);
    void sendTurn(opening);
  }

  function send() {
    const content = draft.trim();
    if (!content || sending || !started) return;
    const nextMessages: CoachChatMessage[] = [...messages, { role: "user", content }];
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
          <div key={i} className={`bubble ${msg.role}`}>
            {msg.content}
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

      {(readyForAnalysis || readyForMealPlan) && (
        <div className="coach-actions">
          {readyForAnalysis && (
            <button
              type="button"
              className="secondary"
              disabled={analysisLoading}
              onClick={onRunAnalysis}
            >
              {analysisLoading ? "Analyzing…" : "Run health analysis"}
            </button>
          )}
          {readyForMealPlan && (
            <button
              type="button"
              className="secondary"
              disabled={mealPlanLoading}
              onClick={onRunMealPlan}
            >
              {mealPlanLoading ? "Planning…" : "Generate meal plan"}
            </button>
          )}
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
