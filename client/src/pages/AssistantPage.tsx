import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AUTH_TOKEN_KEY, apiClient } from "../api/client";
import { Button, Card, EmptyState, ErrorMessage, Select, Spinner } from "../components/ui";
import { usePolicies } from "../hooks/useCustomerData";
import type { AssistantSource, ChatMessage, Policy, PolicyType } from "../types";

interface AssistantHistoryResponse {
  items: ChatMessage[];
}

class AssistantRequestError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "AssistantRequestError";
    this.status = status;
  }
}

let pendingMessageSequence = 0;

const exampleQuestions: Record<PolicyType, string[]> = {
  AUTO: [
    "What is my collision deductible?",
    "What should I do after an accident?",
    "Does my policy include rental car coverage?",
  ],
  HOME: [
    "What should I do if my home is damaged?",
    "Which types of property are covered?",
    "What is excluded from my policy?",
  ],
  HEALTH: [
    "How do I find out whether a service is covered?",
    "What should I know about my deductible?",
    "How do I submit a claim?",
  ],
  TRAVEL: [
    "What should I do if my trip is interrupted?",
    "Which travel expenses may be covered?",
    "How do I report a lost bag?",
  ],
};

function policyLabel(policy: Policy): string {
  const type = policy.type.charAt(0) + policy.type.slice(1).toLowerCase();
  return `${type} policy · ${policy.policyNumber}`;
}

function AssistantInfoNote() {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950" role="note">
      This assistant is informational, answers only from fictional policy documents, and does not decide coverage.
    </div>
  );
}

function friendlyAssistantError(error: unknown): string {
  if (error instanceof AssistantRequestError) {
    if (error.status === 429) return error.message || "The assistant is busy. Please try again later.";
    if (error.status === 503) return "The policy assistant is unavailable right now. Please try again later.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 503) {
    return "The policy assistant is unavailable right now. Please try again later.";
  }
  return "We couldn't load your conversation. Please try again.";
}

function historyQuery(policyId: string) {
  return {
    queryKey: ["assistant-history", policyId] as const,
    queryFn: async () => {
      const response = await apiClient.get<AssistantHistoryResponse>("/api/assistant/history", {
        params: { policyId },
      });
      return response.data.items;
    },
  };
}

function parseEvent(event: string): { name: string; data: unknown } | null {
  const lines = event.split(/\r?\n/);
  const name = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message";
  const data = lines.filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart()).join("\n");
  if (!data) return null;
  return { name, data: JSON.parse(data) as unknown };
}

async function streamAssistantAnswer(
  policyId: string,
  question: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<AssistantSource[]> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const apiUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
  const response = await fetch(`${apiUrl}/api/assistant/ask`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ policyId, question }),
    signal,
  });

  if (!response.ok) {
    let payload: { error?: string } = {};
    try {
      payload = await response.json() as { error?: string };
    } catch {
      // A friendly local message is used if the server does not return JSON.
    }
    throw new AssistantRequestError(payload.error ?? "", response.status);
  }
  if (!response.body) {
    throw new AssistantRequestError("The assistant response could not be streamed.", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sources: AssistantSource[] = [];
  let finished = false;
  const consume = (rawEvent: string) => {
    const parsed = parseEvent(rawEvent);
    if (!parsed || typeof parsed.data !== "object" || parsed.data === null) return;
    const data = parsed.data as Record<string, unknown>;
    if (parsed.name === "delta" && typeof data.text === "string") {
      onText(data.text);
    } else if (parsed.name === "done") {
      sources = Array.isArray(data.sources) ? data.sources as AssistantSource[] : [];
      finished = true;
    } else if (parsed.name === "error") {
      const status = typeof data.status === "number" ? data.status : 502;
      const message = typeof data.message === "string" ? data.message : "";
      throw new AssistantRequestError(message, status);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) consume(event);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!finished) {
    throw new AssistantRequestError("The assistant response ended unexpectedly. Please try again.", 502);
  }
  return sources;
}

export function AssistantPage() {
  const policiesQuery = usePolicies();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPolicyId = searchParams.get("policyId") ?? "";
  const activePolicies = useMemo(
    () => (policiesQuery.data ?? []).filter((policy) => policy.status === "ACTIVE"),
    [policiesQuery.data],
  );
  const selectedPolicy = activePolicies.find((policy) => policy.id === requestedPolicyId) ?? activePolicies[0];
  const policyId = selectedPolicy?.id ?? "";
  const history = useQuery({
    ...historyQuery(policyId),
    enabled: Boolean(policyId),
  });
  const [question, setQuestion] = useState("");
  const [pendingConversation, setPendingConversation] = useState<{
    policyId: string;
    messages: ChatMessage[];
  }>({ policyId: "", messages: [] });
  const [requestErrorState, setRequestErrorState] = useState({
    policyId: "",
    message: "",
  });
  const pendingMessages = pendingConversation.policyId === policyId
    ? pendingConversation.messages
    : [];
  const requestError = requestErrorState.policyId === policyId
    ? requestErrorState.message
    : "";
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const responseFocusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (policyId && requestedPolicyId !== policyId) {
      setSearchParams({ policyId }, { replace: true });
    }
  }, [policyId, requestedPolicyId, setSearchParams]);

  const messages = [...(history.data ?? []), ...pendingMessages];
  const selectedExamples = selectedPolicy ? exampleQuestions[selectedPolicy.type] : [];

  function selectPolicy(nextPolicyId: string) {
    setQuestion("");
    setRequestErrorState({ policyId: nextPolicyId, message: "" });
    setSearchParams(nextPolicyId ? { policyId: nextPolicyId } : {});
  }

  function updatePendingAnswer(text: string, sources?: AssistantSource[]) {
    setPendingConversation((current) => current.policyId !== policyId ? current : {
      ...current,
      messages: current.messages.map((message, index) =>
        index === current.messages.length - 1
        ? {
            ...message,
            content: message.content + text,
            ...(sources ? { sources } : {}),
          }
        : message,
      ),
    });
  }

  async function submitQuestion(value = question) {
    const trimmedQuestion = value.trim();
    if (!policyId || trimmedQuestion.length < 3 || isSending) return;

    const messageSequence = ++pendingMessageSequence;
    const questionId = `pending-user-${messageSequence}`;
    const answerId = `pending-assistant-${messageSequence}`;
    setPendingConversation((current) => ({
      policyId,
      messages: [
      ...(current.policyId === policyId ? current.messages : []),
      {
        id: questionId,
        policyId,
        role: "USER",
        content: trimmedQuestion,
        sources: null,
        createdAt: "",
      },
      {
        id: answerId,
        policyId,
        role: "ASSISTANT",
        content: "",
        sources: null,
        createdAt: "",
      },
      ],
    }));
    setQuestion("");
    setRequestErrorState({ policyId, message: "" });
    setIsSending(true);
    window.requestAnimationFrame(() => {
      conversationRef.current?.focus();
      conversationRef.current?.scrollTo({
        top: conversationRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    const controller = new AbortController();

    try {
      const sources = await streamAssistantAnswer(policyId, trimmedQuestion, controller.signal, (text) => {
        updatePendingAnswer(text);
      });
      updatePendingAnswer("", sources);
      const refreshed = await queryClient.fetchQuery(historyQuery(policyId));
      setPendingConversation({ policyId, messages: [] });
      queryClient.setQueryData(historyQuery(policyId).queryKey, refreshed);
      window.requestAnimationFrame(() => responseFocusRef.current?.focus());
    } catch (error) {
      setRequestErrorState({ policyId, message: friendlyAssistantError(error) });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  async function clearConversation() {
    if (!policyId || !window.confirm("Clear all messages for this policy? This cannot be undone.")) return;
    setRequestErrorState({ policyId, message: "" });
    try {
      await apiClient.delete("/api/assistant/history", { params: { policyId } });
      setPendingConversation({ policyId, messages: [] });
      await queryClient.invalidateQueries({ queryKey: ["assistant-history", policyId] });
    } catch (error) {
      setRequestErrorState({ policyId, message: friendlyAssistantError(error) });
    }
  }

  if (policiesQuery.isPending) {
    return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ask about my policy</h1><AssistantInfoNote /><Spinner label="Loading your policies" /></div>;
  }
  if (policiesQuery.isError) {
    return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ask about my policy</h1><AssistantInfoNote /><ErrorMessage message="We couldn't load your policies. Please try again." /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Policy support</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Ask about my policy</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Ask a question about one of your active policies and get a short answer grounded in its policy documents.</p>
      </header>

      <AssistantInfoNote />

      {activePolicies.length === 0 ? (
        <Card><EmptyState title="No active policies" description="An active policy is needed before you can ask a policy question." headingLevel={2} /></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <Select
                  label="Choose a policy"
                  name="assistant-policy"
                  value={policyId}
                  onChange={(event) => selectPolicy(event.target.value)}
                  options={activePolicies.map((policy) => ({ value: policy.id, label: policyLabel(policy) }))}
                />
              </div>
              <Button variant="outline" onClick={() => void clearConversation()} disabled={!messages.length || isSending}>
                Clear conversation
              </Button>
            </div>
          </Card>

          {requestError && <ErrorMessage message={requestError} />}
          {history.isError && <ErrorMessage message="We couldn't load this conversation. Please try again." />}
          {history.isPending ? (
            <Card><Spinner label="Loading conversation" /></Card>
          ) : (
            <Card>
              {messages.length === 0 ? (
                <EmptyState title="Start a conversation" description="Choose an example or type a question about this policy." headingLevel={2} />
              ) : (
                <div
                  ref={conversationRef}
                  className="max-h-[min(60vh,36rem)] space-y-5 overflow-y-auto pr-1"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label="Conversation"
                  role="log"
                  tabIndex={-1}
                >
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      ref={message.id.startsWith("pending-assistant-") ? responseFocusRef : undefined}
                      tabIndex={message.id.startsWith("pending-assistant-") ? -1 : undefined}
                      className={`max-w-[92%] rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${message.role === "USER" ? "ml-auto bg-teal-800 text-white" : "mr-auto border border-slate-200 bg-slate-50 text-slate-900"}`}
                    >
                      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${message.role === "USER" ? "text-teal-100" : "text-teal-900"}`}>
                        {message.role === "USER" ? "You" : "Policy assistant"}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.content || (isSending ? "Thinking…" : "")}
                      </p>
                      {message.role === "ASSISTANT" && message.sources && message.sources.length > 0 && (
                        <section className="mt-4 border-t border-slate-200 pt-3" aria-label="Sources">
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Sources</h3>
                          <div className="grid gap-2">
                            {message.sources.map((source, index) => (
                              <details key={`${source.documentTitle}-${source.sectionTitle}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800">
                                <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
                                  <span className="font-semibold">{source.documentTitle}</span>
                                  <span className="block pl-5 text-xs text-slate-600">{source.sectionTitle}</span>
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{source.excerpt}</p>
                              </details>
                            ))}
                          </div>
                        </section>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </Card>
          )}

          {!history.isPending && selectedPolicy && (
            <Card>
              <h2 className="text-base font-semibold text-slate-950">Example questions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={isSending}
                    onClick={() => void submitQuestion(example)}
                    className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-left text-sm text-teal-900 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitQuestion();
                }}
              >
                <label htmlFor="assistant-question" className="mb-1.5 block text-sm font-medium text-slate-700">Your question</label>
                <textarea
                  ref={textareaRef}
                  id="assistant-question"
                  value={question}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about this policy…"
                  aria-describedby="assistant-question-count"
                  className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
                />
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p id="assistant-question-count" className="text-xs text-slate-600">{question.length}/500 characters</p>
                  <Button type="submit" disabled={isSending || question.trim().length < 3}>
                    {isSending ? "Answering…" : "Ask question"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
