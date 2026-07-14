"use client";

import { useRef, useState } from "react";
import type { ImageKind } from "../lib/health-types";
import { normalizeImageForUpload } from "../lib/image-utils";
import type {
  CoachAttachment,
  CoachChatMessage,
  CoachJointDraft,
  CoachMealLogDraft,
  CoachProfile,
  CoachState,
  CoachWalkSpotDraft
} from "../lib/coach-types";

const PHOTO_LABELS: Record<ImageKind, string> = {
  face: "face",
  frontBody: "front body",
  sideBody: "side body",
  posture: "posture (side-standing)"
};

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
  onPhotoCaptured,
  onLogMeal,
  onSaveJoint,
  onSaveWalkSpot,
  onRunAnalysis,
  onRunMealPlan,
  analysisLoading,
  mealPlanLoading
}: Props) {
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<CoachAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedPhoto, setRequestedPhoto] = useState<ImageKind | null>(null);
  const [readyForAnalysis, setReadyForAnalysis] = useState(false);
  const [readyForMealPlan, setReadyForMealPlan] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendTurn(nextMessages: CoachChatMessage[]) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, messages: nextMessages })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Coach chat failed.");

      if (payload.profileUpdates) onProfileUpdates(payload.profileUpdates);
      if (payload.logMeal) onLogMeal(payload.logMeal);
      if (payload.saveJoint) onSaveJoint(payload.saveJoint);
      if (payload.saveWalkSpot) onSaveWalkSpot(payload.saveWalkSpot);
      if (payload.requestPhoto !== undefined) setRequestedPhoto(payload.requestPhoto);
      if (payload.readyForAnalysis !== undefined) setReadyForAnalysis(Boolean(payload.readyForAnalysis));
      if (payload.readyForMealPlan !== undefined) setReadyForMealPlan(Boolean(payload.readyForMealPlan));

      setMessages([...nextMessages, { role: "coach", content: payload.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach chat failed.");
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  function startConversation() {
    if (started || sending) return;
    setStarted(true);
    const opening: CoachChatMessage[] = [{ role: "user", content: "Hi, let's get started." }];
    setMessages(opening);
    void sendTurn(opening);
  }

  async function send() {
    const content = draft.trim() || (pendingAttachment ? "Here's the photo." : "");
    if (!content || sending) return;

    const userMessage: CoachChatMessage = pendingAttachment
      ? { role: "user", content, attachment: pendingAttachment }
      : { role: "user", content };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setPendingAttachment(null);
    void sendTurn(nextMessages);
  }

  async function handleAttachFile(file: File) {
    const kind = requestedPhoto ?? "face";
    const { mimeType, data } = await normalizeImageForUpload(file);
    const attachment: CoachAttachment = { kind, mimeType, data };
    setPendingAttachment(attachment);
    onPhotoCaptured(attachment);
  }

  return (
    <div className="card">
      <h2>Your AI Health &amp; food coach</h2>
      <p className="muted">
        One conversation: profile, photos, meal logging, and daily order plans. Confirm buttons appear here once the
        coach has enough to work with.
      </p>
      <div className="chat-panel">
        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && !sending && (
            <div className="chat-empty">
              <button type="button" className="primary" onClick={startConversation}>
                Start chatting with your coach
              </button>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`chat-bubble ${message.role}`}>
              {message.attachment && (
                <img
                  src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`}
                  alt={PHOTO_LABELS[message.attachment.kind]}
                  className="chat-attachment-thumb"
                />
              )}
              {message.content}
            </div>
          ))}
          {sending && <div className="chat-bubble coach">Thinking…</div>}
        </div>

        {(readyForAnalysis || readyForMealPlan) && (
          <div className="chat-cta-row">
            {readyForAnalysis && (
              <button type="button" className="secondary" disabled={analysisLoading} onClick={onRunAnalysis}>
                {analysisLoading ? "Analyzing…" : "Run health analysis"}
              </button>
            )}
            {readyForMealPlan && (
              <button type="button" className="secondary" disabled={mealPlanLoading} onClick={onRunMealPlan}>
                {mealPlanLoading ? "Planning…" : "Generate meal plan"}
              </button>
            )}
          </div>
        )}

        {pendingAttachment && (
          <div className="chat-pending-attachment">
            <img
              src={`data:${pendingAttachment.mimeType};base64,${pendingAttachment.data}`}
              alt={PHOTO_LABELS[pendingAttachment.kind]}
            />
            <span className="muted">{PHOTO_LABELS[pendingAttachment.kind]} photo attached</span>
            <button type="button" className="secondary" onClick={() => setPendingAttachment(null)}>
              Remove
            </button>
          </div>
        )}

        <div className="chat-input-row">
          <button
            type="button"
            className="secondary chat-attach-btn"
            disabled={!started || sending}
            title={requestedPhoto ? `Attach ${PHOTO_LABELS[requestedPhoto]} photo` : "Attach a photo"}
            onClick={() => fileInputRef.current?.click()}
          >
            📷
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleAttachFile(file);
              event.target.value = "";
            }}
          />
          <input
            value={draft}
            placeholder={requestedPhoto ? `Attach your ${PHOTO_LABELS[requestedPhoto]} photo, or reply here` : "Reply to your coach…"}
            disabled={!started}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="primary" disabled={!started || sending || (!draft.trim() && !pendingAttachment)} onClick={() => void send()}>
            Send
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
