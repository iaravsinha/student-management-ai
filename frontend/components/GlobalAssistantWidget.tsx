import { FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { aiApi } from "../lib/ai-api";
import { AIResponse, Student } from "../lib/types";
import { getErrorMessage, getLocalDateInputValue } from "../lib/utils";
import { api } from "../lib/api";

type WidgetMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PersistedState = {
  messages: WidgetMessage[];
  studentId: string;
  timetableId: string;
  date: string;
  execute: boolean;
};

const STORAGE_KEY = "studentms-global-assistant";

const quickStarters = [
  "Summarize today’s attendance risk.",
  "What weak subjects should we watch?",
  "Draft a short parent update note.",
];

const TypingDots = () => (
  <div className="flex items-center gap-1 px-1 py-0.5" aria-hidden>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-cyan-600/70 animate-typing-dot"
        style={{ animationDelay: `${i * 0.14}s` }}
      />
    ))}
  </div>
);

export const GlobalAssistantWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [timetableId, setTimetableId] = useState("");
  const [date, setDate] = useState(getLocalDateInputValue());
  const [execute, setExecute] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedState;
      setMessages(parsed.messages || []);
      setStudentId(parsed.studentId || "");
      setTimetableId(parsed.timetableId || "");
      setDate(parsed.date || getLocalDateInputValue());
      setExecute(Boolean(parsed.execute));
    } catch {
      // ignore malformed local storage payloads
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload: PersistedState = { messages, studentId, timetableId, date, execute };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [messages, studentId, timetableId, date, execute]);

  useEffect(() => {
    if (user?.role !== "student") {
      return;
    }
    if (studentId) {
      return;
    }
    const loadProfile = async () => {
      try {
        const response = await api.get<Student>("/students/me");
        setStudentId(String(response.data.id));
      } catch {
        // no-op
      }
    };
    void loadProfile();
  }, [studentId, user?.role]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (event?: FormEvent, overrideQuery?: string) => {
    event?.preventDefault();
    const cleanQuery = (overrideQuery ?? query).trim();
    if (!cleanQuery || loading) {
      return;
    }

    const userMessage: WidgetMessage = { id: `${Date.now()}-u`, role: "user", content: cleanQuery };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuery("");
    setError("");
    setLoading(true);

    try {
      const response = await aiApi.post<AIResponse>("/query", {
        query: cleanQuery,
        student_id: Number(studentId) > 0 ? Number(studentId) : undefined,
        timetable_id: Number(timetableId) > 0 ? Number(timetableId) : undefined,
        date,
        execute,
        conversation_history: nextMessages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
      const assistantMessage: WidgetMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: response.data.answer,
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (sendError) {
      const errText = getErrorMessage(sendError, "Assistant request failed. Check your connection.");
      setError(errText);
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-err`, role: "assistant", content: `Could not respond: ${errText}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="flex max-h-[min(560px,calc(100vh-6rem))] w-[min(400px,calc(100vw-2.25rem))] flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/95 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur-xl animate-fade-up"
          style={{ animationDuration: "0.35s" }}
        >
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-5 pb-6 pt-5 text-white">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-amber-400/15 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-2 ring-white/20 backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-200" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1v1h-4v-1a5 5 0 0 0-5-5c-1.5 0-2.85.67-3.76 1.73L12 11l1.41-1.41L8 4.17 2.58 9.59 4 11l4-4 4 4 4-4 4 4-9 9H2v-2a9 9 0 0 1 9-9h1V5.73c-.59-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Copilot</p>
                  <p className="text-lg font-semibold tracking-tight">Campus assistant</p>
                  <p className="mt-0.5 max-w-[220px] text-xs leading-snug text-slate-300">
                    Contextual answers across attendance, grades, and schedule—without leaving your screen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="scrollbar-thin min-h-[140px] flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/90 to-white px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200/90 bg-white/80 px-4 py-5">
                <p className="text-sm font-semibold text-slate-800">Pick a starter or type your own</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Threads persist while you browse—expand context below when you need IDs or dates.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {quickStarters.map((line) => (
                    <button
                      key={line}
                      type="button"
                      disabled={loading}
                      onClick={() => void send(undefined, line)}
                      className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 transition hover:border-cyan-300/60 hover:bg-cyan-50/40 disabled:opacity-50"
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cnBubble(message.role)}
                  style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={
                        message.role === "user"
                          ? "text-[10px] font-bold uppercase tracking-wider text-white/70"
                          : "text-[10px] font-bold uppercase tracking-wider text-cyan-700"
                      }
                    >
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.content}</p>
                </div>
              ))
            )}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <TypingDots />
                    <span className="text-xs font-medium text-slate-500">Composing a precise reply…</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-3 border-t border-slate-200/80 bg-white/95 px-4 py-4">
            <details className="group rounded-xl border border-slate-200/80 bg-slate-50/90 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[13px] font-semibold text-slate-700">
                Advanced context
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden>
                  <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                </svg>
              </summary>
              <div className="space-y-2 border-t border-slate-200/70 px-3 pb-3 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" className="!py-2 text-xs" />
                  <input value={timetableId} onChange={(e) => setTimetableId(e.target.value)} placeholder="Class ID" className="!py-2 text-xs" />
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!py-2 text-xs" />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                  <input type="checkbox" checked={execute} onChange={(e) => setExecute(e.target.checked)} className="rounded border-slate-300" />
                  Execute allowed commands
                </label>
              </div>
            </details>

            <form onSubmit={(e) => void send(e)} className="space-y-2">
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={3}
                placeholder="Ask in plain language…"
                className="resize-none text-[13px] shadow-inner shadow-slate-900/[0.02]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/10 transition hover:from-slate-800 hover:to-slate-900 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <TypingDots />
                    Sending
                  </>
                ) : (
                  "Send message"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 text-sm font-bold tracking-wide text-white shadow-[0_12px_40px_-8px_rgba(15,23,42,0.65)] ring-2 ring-white/90 transition hover:scale-[1.04] hover:shadow-xl focus-visible:ring-[3px] focus-visible:ring-cyan-400/40"
        aria-label="Open assistant"
      >
        <span className="pointer-events-none absolute inset-[-6px] rounded-full bg-gradient-to-br from-cyan-400/40 to-amber-300/30 opacity-0 blur-md transition group-hover:opacity-100" />
        <span className="relative">AI</span>
      </button>
    </div>
  );
};

function cnBubble(role: "user" | "assistant") {
  if (role === "user") {
    return "ml-8 animate-fade-up rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-3 text-white shadow-lg shadow-slate-900/20";
  }
  return "mr-6 animate-fade-up rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-slate-800 shadow-sm";
}
