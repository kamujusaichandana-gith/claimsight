import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { Badge } from "../components/ui";
import { ClaimsPage } from "./CustomerPages";
import { ClaimReviewPage } from "./AdminPages";
import { admin, adminClaim, claim, createFakeAuth, mockGetResponses, renderWithProviders } from "../test/test-utils";
import { LocationProbe } from "../test/LocationProbe";

const claimListResponse = {
  items: [claim],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 5 },
};

const adminSummaryResponse = {
  enabled: false,
  summary: null,
  generatedAt: null,
  model: null,
};

function renderClaims(initialEntry = "/claims") {
  vi.mocked(apiClient.get).mockImplementation(mockGetResponses({
    "/api/claims": claimListResponse,
  }));
  return renderWithProviders(
    <>
      <Routes><Route path="/claims" element={<ClaimsPage />} /></Routes>
      <LocationProbe />
    </>,
    { initialEntries: [initialEntry] },
  );
}

function renderClaimReview(status: typeof adminClaim.status) {
  vi.mocked(apiClient.get).mockImplementation(mockGetResponses({
    "/api/admin/claims/claim-1": { claim: { ...adminClaim, status } },
    "/api/admin/claims/claim-1/summary": adminSummaryResponse,
  }));
  return renderWithProviders(
    <Routes><Route path="/admin/claims/:id" element={<ClaimReviewPage />} /></Routes>,
    { auth: createFakeAuth({ user: admin }), initialEntries: ["/admin/claims/claim-1"] },
  );
}

describe("shared status and claim-list behavior", () => {
  it("labels every claim status in text", () => {
    const statuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAID"] as const;
    renderWithProviders(
      <div>{statuses.map((status) => <Badge key={status} status={status} />)}</div>,
    );

    expect(screen.getByText("submitted")).toBeInTheDocument();
    expect(screen.getByText("under review")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });

  it("formats USD safely and displays dates consistently", async () => {
    vi.mocked(apiClient.get).mockImplementation(mockGetResponses({
      "/api/claims": {
        items: [
          { ...claim, id: "valid", amount: "1234.5", incidentDate: "2025-03-04T00:00:00.000Z" },
          { ...claim, id: "invalid", amount: "not-a-number", incidentDate: "invalid-date" },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    }));
    renderWithProviders(<ClaimsPage />, { initialEntries: ["/claims"] });

    expect(await screen.findByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("Mar 4, 2025")).toBeInTheDocument();
    expect(screen.getAllByText("—", { selector: "td" })).toHaveLength(2);
  });

  it("reads filters, sort and page from the URL and writes changes back", async () => {
    const user = userEvent.setup();
    renderClaims("/claims?status=APPROVED&sortBy=amount&order=asc&page=2");

    await screen.findByRole("table", { name: "Your claims and their current status" });
    expect(apiClient.get).toHaveBeenCalledWith("/api/claims", {
      params: expect.objectContaining({
        status: "APPROVED",
        sortBy: "amount",
        order: "asc",
        page: 2,
      }),
    });
    expect(screen.getByLabelText("Filter by status")).toHaveValue("APPROVED");
    expect(screen.getByLabelText("Sort by")).toHaveValue("amount");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("page=3"));
    await user.selectOptions(screen.getByLabelText("Filter by status"), "REJECTED");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("status=REJECTED"));
    expect(screen.getByTestId("location")).not.toHaveTextContent("page=");
    await user.selectOptions(screen.getByLabelText("Sort by"), "claimNumber");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("sortBy=claimNumber"));
    expect(screen.getByTestId("location")).toHaveTextContent("order=desc");
  });

  it("waits for the search debounce before updating the query", async () => {
    const user = userEvent.setup();
    renderClaims();
    await screen.findByRole("table");
    const requestedParams: unknown[] = [];
    vi.mocked(apiClient.get).mockImplementation(async (_url, config) => {
      requestedParams.push(config?.params);
      return { data: claimListResponse } as never;
    });

    await user.type(screen.getByLabelText("Search claims"), "damage");
    expect(screen.getByTestId("location")).not.toHaveTextContent("search=damage");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("search=damage"), {
      timeout: 1500,
    });
    await waitFor(() => {
      expect(requestedParams).toEqual(expect.arrayContaining([
        expect.objectContaining({ search: "damage" }),
      ]));
    });
  });
});

describe("admin claim review", () => {
  it("offers only valid next statuses", async () => {
    const states = [
      { status: "SUBMITTED" as const, offered: ["Move to under review"], forbidden: ["Approve claim", "Reject claim", "Mark as paid"] },
      { status: "UNDER_REVIEW" as const, offered: ["Approve claim", "Reject claim"], forbidden: ["Move to under review", "Mark as paid"] },
      { status: "APPROVED" as const, offered: ["Mark as paid"], forbidden: ["Move to under review", "Approve claim", "Reject claim"] },
    ];

    for (const state of states) {
      const rendered = renderClaimReview(state.status);
      for (const label of state.offered) {
        expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
      }
      for (const label of state.forbidden) {
        expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      }
      rendered.unmount();
    }
  });

  it("explains that REJECTED and PAID claims are final", async () => {
    for (const status of ["REJECTED", "PAID"] as const) {
      const rendered = renderClaimReview(status);
      expect(await screen.findByText(`This claim is ${status.toLowerCase()} and its status is final. No further status changes are available.`)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /claim|paid/i })).not.toBeInTheDocument();
      rendered.unmount();
    }
  });

  it("opens a focus-trapped confirmation dialog, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    renderClaimReview("UNDER_REVIEW");
    const opener = await screen.findByRole("button", { name: "Reject claim" });

    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Confirm status change" });
    expect(dialog).toHaveTextContent("Change this claim from Under review to Rejected?");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm change" });
    expect(cancel).toHaveFocus();

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
