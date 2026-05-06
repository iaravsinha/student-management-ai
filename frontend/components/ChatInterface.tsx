import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { aiApi } from "../lib/ai-api";
import { api } from "../lib/api";
import { AIResponse, Student, StudentListResponse, TimetableEntry } from "../lib/types";
import { formatLabel, formatTime, getErrorMessage, getLocalDateInputValue } from "../lib/utils";
import { ActionButton, Badge, EmptyState, SectionCard } from "./ui";

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
};

type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "edxplore-assistant-page";

const studentSuggestions = [
  { text: "Summarize my attendance and highlights.", tag: "Attendance" },
  { text: "How are my grades in recent exams?", tag: "Performance" },
  { text: "Show my timetable for this week.", tag: "Schedule" },
  { text: "What areas should I focus on to improve my score?", tag: "Planning" },
];

const teacherSuggestions = [
  { text: "Who is at risk due to low attendance in my department?", tag: "Attendance" },
  { text: "Show performance metrics and weak subjects in my classes.", tag: "Performance" },
  { text: "Mark all present for today's slot.", tag: "Operations" },
  { text: "Draft a parent update note for underperforming students.", tag: "Communication" },
];

const adminSuggestions = [
  { text: "Show an overview of total classes and overall attendance.", tag: "Directory" },
  { text: "Identify high-risk departments with lowest average grades.", tag: "Analytics" },
  { text: "Create a new subject called 'Advanced AI'.", tag: "Operations" },
  { text: "How many active students are enrolled across all programs?", tag: "Directory" },
];


const TypingDots = () => (
  <div className="flex items-center gap-1.5" aria-hidden>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-2 w-2 rounded-full bg-cyan-500 animate-typing-dot"
        style={{ animationDelay: `${i * 0.14}s` }}
      />
    ))}
  </div>
);

export const ChatInterface = () => {
  const { user } = useAuth();
  const isStudentUser = user?.role === "student";
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<TimetableEntry[]>([]);
  const [timetableId, setTimetableId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalDateInputValue());
  const [executeCommand, setExecuteCommand] = useState(false);
  const [myProfile, setMyProfile] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const historyRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    if (user?.role === "student") return studentSuggestions;
    if (user?.role === "teacher") return teacherSuggestions;
    return adminSuggestions;
  }, [user?.role]);

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save history to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const canSend = useMemo(
    () => query.trim().length > 0 && !loading,
    [query, loading],
  );

  useEffect(() => {
    const el = historyRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!isStudentUser) {
      return;
    }

    const loadMyProfile = async () => {
      try {
        const response = await api.get<Student>("/students/me");
        setMyProfile(response.data);
        setStudentId(String(response.data.id));
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load your student profile"));
      }
    };

    void loadMyProfile();
  }, [isStudentUser]);

  useEffect(() => {
    if (isStudentUser) {
      return;
    }

    const loadContextOptions = async () => {
      try {
        const [studentsResponse, timetableResponse] = await Promise.all([
          api.get<StudentListResponse>("/students", { params: { page: 1, page_size: 100 } }),
          api.get<TimetableEntry[]>("/timetable"),
        ]);
        setStudents(studentsResponse.data.items);
        setClasses(timetableResponse.data);
        setStudentId((current) => current || String(studentsResponse.data.items[0]?.id || ""));
        setTimetableId((current) => current || String(timetableResponse.data[0]?.id || ""));
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load assistant context"));
      }
    };

    void loadContextOptions();
  }, [isStudentUser]);

  const sendMessage = async (prompt: string) => {
    const cleanQuery = prompt.trim();
    if (!cleanQuery || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: cleanQuery,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setError("");
    setLoading(true);

    try {
      const conversationHistory: AssistantHistoryMessage[] = [...messages, userMessage]
        .slice(-12)
        .map((message) => ({
          role: message.role === "ai" ? "assistant" : "user",
          content: message.content,
        }));

      const response = await aiApi.post<AIResponse>("/query", {
        student_id: Number(studentId) > 0 ? Number(studentId) : undefined,
        timetable_id: Number(timetableId) > 0 ? Number(timetableId) : undefined,
        date: selectedDate,
        execute: executeCommand,
        query: cleanQuery,
        conversation_history: conversationHistory,
      });
      const aiMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "ai",
        content: response.data.answer,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (submitError) {
      const errText = getErrorMessage(submitError, "Unable to reach the AI assistant. Please check your connection or try again.");
      setError(errText);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-err`, role: "ai", content: `Could not get a response: ${errText}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    await sendMessage(query);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <div className="space-y-4 xl:sticky xl:top-28">
        <SectionCard
          title="Conversation lens"
          description="Choose who you are advising—the assistant injects role, permissions, and academic context."
          className="!p-5 sm:!p-6"
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm">
              <label className="block space-y-2">
                <span className="text-[13px] font-semibold text-slate-700">Student focus</span>
                {isStudentUser ? (
                  <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Enrollment Number" disabled />
                ) : (
                  <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="text-[13px]">
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.enrollment_number} — {student.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              {isStudentUser && myProfile ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{myProfile.name}</Badge>
                  <span className="text-xs text-slate-500">{myProfile.enrollment_number}</span>
                </div>
              ) : null}
            </div>

            {!isStudentUser ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <label className="block space-y-2">
                  <span className="text-[13px] font-semibold text-slate-700">Class & timing</span>
                  <select value={timetableId} onChange={(event) => setTimetableId(event.target.value)} className="text-[13px]">
                    <option value="">Optional class slot</option>
                    {classes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {formatLabel(entry.day)} · {formatTime(entry.start_time)} · {entry.subject_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-[13px] font-semibold text-slate-700">Command date</span>
                    <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="text-[13px]" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 text-[13px] font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={executeCommand}
                      onChange={(event) => setExecuteCommand(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Execute safe commands
                  </label>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[13px] font-semibold text-slate-700">Suggested prompts</p>
              <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
                {suggestions.map(({ text, tag }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => void sendMessage(text)}
                    disabled={loading || (isStudentUser && Number(studentId) <= 0)}
                    className="group shrink-0 max-w-[240px] rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-left shadow-sm transition hover:border-cyan-300/70 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">{tag}</span>
                    <p className="mt-1 text-[13px] leading-snug text-slate-700">{text}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-slate-600">How replies are shaped</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Each answer considers your role, selected records, and recent chat turns—then surfaces actionable language without breaking permission boundaries.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="app-surface flex min-h-[560px] flex-col overflow-hidden p-0 xl:min-h-[720px]">
        <div className="relative shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 px-6 py-5 text-white">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-cyan-400/15 to-transparent" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">Live thread</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Natural language workspace</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Messages stay on this page—pair them with the lens on the left for richer answers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral" className="border-white/10 bg-white/10 text-white ring-white/20">
                {formatLabel(user?.role || "guest")}
              </Badge>
              {Number(studentId) > 0 ? (
                <Badge tone="brand" className="border-cyan-400/30 bg-cyan-500/20 text-cyan-50 ring-cyan-400/30">
                  Student #{studentId}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div
          ref={historyRef}
          className="scrollbar-thin flex-1 overflow-y-auto px-4 py-8 sm:px-6"
          style={{
            backgroundColor: "#f8fafc",
            backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 0)",
            backgroundSize: "24px 24px",
            minHeight: "400px",
          }}
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                title="Shape your first question"
                description="Choose a suggested chip or describe the scenario—the assistant keeps prior turns for smoother follow-ups."
              />
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-8">
              {messages.map((message, i) => (
                <div
                  key={message.id}
                  className="flex w-full"
                  style={{
                    justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      maxWidth: "85%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      borderRadius: "24px",
                      padding: "16px 20px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      backgroundColor: message.role === "user" ? "#0f172a" : "#ffffff",
                      color: message.role === "user" ? "#ffffff" : "#1e293b",
                      border: message.role === "user" ? "1px solid #1e293b" : "1px solid #e2e8f0",
                      zIndex: 10,
                      opacity: 1,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: message.role === "user" ? "rgba(255,255,255,0.6)" : "#0e7490",
                        }}
                      >
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        margin: 0,
                        color: "inherit",
                      }}
                    >
                      {message.content}
                    </p>
                    
                    {/* Visual tail */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        height: "16px",
                        width: "16px",
                        [message.role === "user" ? "right" : "left"]: "-6px",
                        color: message.role === "user" ? "#0f172a" : "#ffffff",
                      }}
                      aria-hidden
                    >
                      <svg viewBox="0 0 16 16" style={{ height: "100%", width: "100%", fill: "currentColor" }}>
                        {message.role === "user" ? <path d="M0 16h16L0 0v16z" /> : <path d="M16 16H0L16 0v16z" />}
                      </svg>
                    </div>
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
                    <TypingDots />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Thinking</p>
                      <p className="text-xs text-slate-500">Processing academic context…</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="shrink-0 border-t border-slate-200/80 bg-white/95 px-5 py-5">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSubmit(event as any);
              }
            }}
            placeholder="Ask about attendance signals, weak subjects, predictions, or operational next steps…"
            rows={4}
            className="resize-none text-[14px] shadow-inner shadow-slate-900/[0.03]"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {error ? (
                <p className="text-sm font-medium text-rose-600">{error}</p>
              ) : (
                <p className="text-xs leading-relaxed text-slate-500">
                  {isStudentUser
                    ? "Your profile is pre-loaded — just type your question."
                    : "Select a student or class in the lens for richer context, then ask anything."}
                </p>
              )}
            </div>
            <ActionButton type="submit" disabled={!canSend} className="min-w-[140px] shrink-0">
              {loading ? (
                <span className="flex items-center gap-2">
                  <TypingDots />
                  Sending
                </span>
              ) : (
                "Send"
              )}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};
