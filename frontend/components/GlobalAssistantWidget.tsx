import { FormEvent, useEffect, useState } from "react";

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

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const cleanQuery = query.trim();
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
      setError(getErrorMessage(sendError, "Assistant request failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-slate-950 text-white shadow-xl shadow-slate-900/25 transition hover:scale-[1.02]"
          aria-label="Open assistant"
        >
          AI
        </button>
      ) : (
        <div className="w-[360px] max-w-[92vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Assistant</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500">
              Close
            </button>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">Start chatting from any page.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {message.content}
                </div>
              ))
            )}
            {loading ? <p className="text-xs text-slate-500">Thinking...</p> : null}
          </div>
          <div className="space-y-2 border-t border-slate-200 px-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Student ID" />
              <input value={timetableId} onChange={(event) => setTimetableId(event.target.value)} placeholder="Class ID" />
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={execute} onChange={(event) => setExecute(event.target.checked)} />
              Execute allowed commands
            </label>
            <form onSubmit={send} className="space-y-2">
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={3}
                placeholder="Ask anything..."
              />
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
              <button type="submit" disabled={loading || !query.trim()} className="w-full rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

