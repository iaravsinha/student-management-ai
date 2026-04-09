import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { aiApi } from "../lib/ai-api";
import { api } from "../lib/api";
import { AIResponse, Student } from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { ActionButton, Badge, EmptyState, SectionCard } from "./ui";

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
};

const suggestionPrompts = [
  "Show weak subjects for this student.",
  "Summarize attendance risk for the current student.",
  "What should I focus on next based on recent performance?",
];

export const ChatInterface = () => {
  const { user } = useAuth();
  const isStudentUser = user?.role === "student";
  const [studentId, setStudentId] = useState("1");
  const [myProfile, setMyProfile] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const historyRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => query.trim().length > 0 && Number(studentId) > 0 && !loading,
    [query, studentId, loading],
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
      const response = await aiApi.post<AIResponse>("/query", {
        student_id: Number(studentId),
        query: cleanQuery,
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
              <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Student ID" disabled={isStudentUser} />
            </label>
            {isStudentUser && myProfile ? <p className="mt-3 text-sm text-slate-500">Locked to your profile: {myProfile.name} ({myProfile.enrollment_number})</p> : null}
          </div>

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
              The assistant can help interpret student-specific questions, attendance signals, and learning priorities using the configured AI service.
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
