import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import type { AssistantSource, ChatMessage } from "../types";
import { customer, policy, renderWithProviders } from "../test/test-utils";
import { AssistantPage } from "./AssistantPage";

function mockAssistantGet(history: ChatMessage[]) {
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === "/api/policies") return { data: { items: [policy] } } as never;
    if (url === "/api/assistant/history") return { data: { items: history } } as never;
    throw new Error(`Unexpected API request: ${url}`);
  });
}

function assistantMessage(
  content: string,
  sources: AssistantSource[] | null = null,
): ChatMessage {
  return {
    id: "assistant-1",
    policyId: policy.id,
    role: "ASSISTANT",
    content,
    sources,
    createdAt: "2025-03-05T00:00:00.000Z",
  };
}

function renderAssistant(history: ChatMessage[] = []) {
  mockAssistantGet(history);
  return renderWithProviders(<AssistantPage />, {
    auth: {
      user: customer,
      isLoading: false,
      login: async () => customer,
      register: async () => customer,
      logout: () => undefined,
    },
    initialEntries: [`/assistant?policyId=${policy.id}`],
  });
}

function sseResponse(onStart: (controller: ReadableStreamDefaultController<Uint8Array>) => void) {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({ start: onStart }),
  } as Response;
}

describe("policy assistant", () => {
  it("appends streamed text and renders HTML-like content literally", async () => {
    const user = userEvent.setup();
    const encoder = new TextEncoder();
    let finishStream: (() => void) | undefined;
    const refreshedHistory: ChatMessage[] = [];
    mockAssistantGet(refreshedHistory);
    vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse((controller) => {
      controller.enqueue(encoder.encode('event: delta\ndata: {"text":"<b>safe"}\n\n'));
      finishStream = () => {
        refreshedHistory.push(assistantMessage("<b>safe literal</b>"));
        controller.enqueue(encoder.encode(
          'event: delta\ndata: {"text":" literal</b>"}\n\nevent: done\ndata: {"sources":[]}\n\n',
        ));
        controller.close();
      };
    }));
    renderAssistant(refreshedHistory);
    await screen.findByRole("textbox", { name: "Your question" });
    await user.type(screen.getByRole("textbox", { name: "Your question" }), "What does this policy cover?");
    await user.click(screen.getByRole("button", { name: "Ask question" }));

    expect(await screen.findByText("<b>safe")).toBeInTheDocument();
    expect(document.querySelector("b")).not.toBeInTheDocument();
    expect(finishStream).toBeDefined();
    finishStream?.();
    expect(await screen.findByText("<b>safe literal</b>")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/assistant/ask"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("previews collapsed sources, expands their full text, highlights the best sentence, and labels older excerpts", async () => {
    const user = userEvent.setup();
    const longContent = "Collision coverage pays to repair your vehicle after a covered accident. ".repeat(5)
      + "This final sentence contains additional policy details not shown in the preview.";
    const sources: AssistantSource[] = [
      {
        documentTitle: "Auto Policy",
        sectionTitle: "Collision coverage",
        content: longContent,
      },
      {
        documentTitle: "Legacy Handbook",
        sectionTitle: "Older reference",
        excerpt: "An excerpt from an older assistant conversation.",
      },
    ];
    renderAssistant([assistantMessage("Collision coverage pays for repairs after a covered accident.", sources)]);

    await screen.findByText("Policy assistant");
    const autoDetails = screen.getByText("Auto Policy").closest("details");
    expect(autoDetails).not.toHaveAttribute("open");
    expect(autoDetails?.querySelector(".source-preview")).toHaveTextContent("...");
    expect(autoDetails?.querySelector(".source-preview")?.textContent?.length).toBeLessThan(150);

    await user.click(screen.getByText("Auto Policy"));
    expect(await screen.findByText(/This final sentence contains additional policy details/)).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll(".bg-amber-100"))
        .some((element) => element.textContent === "Collision coverage pays to repair your vehicle after a covered accident."),
    ).toBe(true);

    await user.click(screen.getByText("Legacy Handbook"));
    expect(await screen.findByText("Older message: excerpt only")).toBeInTheDocument();
    expect(screen.getByText("An excerpt from an older assistant conversation.")).toBeInTheDocument();
  });

  it.each([
    [429, "Please wait a moment before asking the assistant again."],
    [503, "The policy assistant is unavailable right now. Please try again later."],
  ])("shows a friendly message when the assistant returns HTTP %i", async (status, expected) => {
    const user = userEvent.setup();
    renderAssistant();
    await screen.findByRole("textbox", { name: "Your question" });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: status === 429 ? "Please wait a moment before asking the assistant again." : "unavailable" }),
    } as Response);

    await user.type(screen.getByRole("textbox", { name: "Your question" }), "What does this policy cover?");
    await user.click(screen.getByRole("button", { name: "Ask question" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });
});
