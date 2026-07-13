"use client";

import { useRef, useState } from "react";
import type { ChatMessage, HealthOsReport } from "../lib/health-types";

type Props = {
  report: HealthOsReport | null;
};

export function ChatCoach({ report }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: "user", content } as ChatMessage];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, report })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Coach chat failed.");
      setMessages((prev) => [...prev, { role: "coach", content: payload.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach chat failed.");
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="card">
      <h2>Chat with your coach</h2>
      <p className="muted">Ask about your routine, posture drills, nutrition, or recovery — grounded in your latest report.</p>
      <div className="chat-panel">
        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <div className="chat-empty">No messages yet. Ask a question to get started.</div>}
          {messages.map((message, index) => (
            <div key={index} className={`chat-bubble ${message.role}`}>
              {message.content}
            </div>
          ))}
          {sending && <div className="chat-bubble coach">Thinking…</div>}
        </div>
        <div className="chat-input-row">
          <input
            value={draft}
            placeholder={report ? "e.g. Which exercise should I do if my back is tight today?" : "Run an analysis first for grounded answers, or ask anything."}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="primary" disabled={sending || !draft.trim()} onClick={() => void send()}>
            Send
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
