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

const suggestionPrompts = [
  "Show weak subjects for this student.",
  "Summarize attendance risk for the current student.",
  "Show students absent today.",
  "Mark all present except roll 4 5 6.",
  "What should I focus on next based on recent performance?",
];

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

  const canSend = useMemo(
    () => query.trim().length > 0 && !loading && (Number(studentId) > 0 || Number(timetableId) > 0),
    [query, studentId, timetableId, loading],
  );

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
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
    if (!cleanQuery || Number(studentId) <= 0) {
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
      setError(getErrorMessage(submitError, "AI request failed"));
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
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <SectionCard title="Query setup" description="Choose the student context and start with a suggested prompt or write your own question.">
        <div className="space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Student ID</span>
              {isStudentUser ? (
                <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Student ID" disabled />
              ) : (
                <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                  <option value="">No student selected</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.enrollment_number} - {student.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {isStudentUser && myProfile ? <p className="mt-3 text-sm text-slate-500">Locked to your profile: {myProfile.name} ({myProfile.enrollment_number})</p> : null}
          </div>

          {!isStudentUser ? (
            <div className="rounded-2xl bg-slate-50 p-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Class context</span>
                <select value={timetableId} onChange={(event) => setTimetableId(event.target.value)}>
                  <option value="">No class selected</option>
                  {classes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {formatLabel(entry.day)} {formatTime(entry.start_time)} - {entry.subject_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Command date</span>
                  <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={executeCommand}
                    onChange={(event) => setExecuteCommand(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 p-0"
                  />
                  Execute allowed commands
                </label>
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-medium text-slate-700">Suggested prompts</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestionPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={loading}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">How this helps</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The assistant injects your role, allowed operations, selected records, and class context before producing a structured command.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Conversation" description="A cleaner chat surface with loading, error, and response states.">
        <div ref={historyRef} className="soft-panel h-[480px] overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState
              title="Start the conversation"
              description="Try a suggested prompt or ask a specific question about a student&apos;s attendance or performance context."
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <div className="mb-2">
                      <Badge tone={message.role === "user" ? "brand" : "neutral"}>{message.role === "user" ? "You" : "AI assistant"}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    AI assistant is thinking...
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about attendance, weak subjects, predictions, or academic follow-up steps..."
            rows={4}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <p className="text-sm text-slate-500">Responses are generated for the student ID entered in the setup panel.</p>}
            <ActionButton type="submit" disabled={!canSend}>{loading ? "Sending..." : "Send message"}</ActionButton>
          </div>
        </form>
      </SectionCard>
    </div>
  );
};
