import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../api/client";
import { ClaimDetailsPage } from "../../CustomerPages";
import { policy, claim, mockGetResponses, renderWithProviders } from "../../../test/test-utils";
import { LocationProbe } from "../../../test/LocationProbe";
import { NewClaimPage } from "./NewClaimPage";

function renderClaimForm() {
  vi.mocked(apiClient.get).mockImplementation(mockGetResponses({
    "/api/policies": { items: [policy] },
    "/api/claims/claim-1": {
      claim: { ...claim, comments: [], documents: [], statusHistory: [] },
    },
  }));
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/claims/new" element={<NewClaimPage />} />
        <Route path="/claims/:id" element={<ClaimDetailsPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { initialEntries: ["/claims/new"] },
  );
}

async function openIncidentStep(user: ReturnType<typeof userEvent.setup>) {
  const radio = await screen.findByRole("radio", { name: /AUTO-1001/ });
  await user.click(radio);
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Incident details" })).toBeInTheDocument();
}

async function fillValidIncident(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Incident date"), "2025-03-04");
  await user.type(screen.getByLabelText("Incident type"), "Vehicle collision");
  await user.type(screen.getByLabelText("Describe what happened"), "The vehicle was damaged in a collision.");
  await user.type(screen.getByLabelText("Estimated claim amount"), "2500");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("new claim form", () => {
  it("blocks Next on empty required fields and shows inline errors", async () => {
    const user = userEvent.setup();
    renderClaimForm();

    await screen.findByRole("radio", { name: /AUTO-1001/ });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a policy");
    expect(screen.queryByRole("heading", { name: "Incident details" })).not.toBeInTheDocument();

    await openIncidentStep(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Choose the date of the incident")).toBeInTheDocument();
    expect(screen.getByText("Enter the incident type")).toBeInTheDocument();
    expect(screen.getByText("Description must be at least 20 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter an estimated amount")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Upload documents" })).not.toBeInTheDocument();
  });

  it("rejects a future incident date", async () => {
    const user = userEvent.setup();
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const futureValue = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    fireEvent.change(screen.getByLabelText("Incident date"), { target: { value: futureValue } });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Incident date cannot be in the future")).toBeInTheDocument();
  });

  it("rejects descriptions shorter than 20 characters", async () => {
    const user = userEvent.setup();
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    fireEvent.change(screen.getByLabelText("Describe what happened"), { target: { value: "Short description" } });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Description must be at least 20 characters")).toBeInTheDocument();
  });

  it("rejects non-positive and over-coverage amounts", async () => {
    const user = userEvent.setup();
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    const amount = screen.getByLabelText("Estimated claim amount");
    fireEvent.change(amount, { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Amount must be greater than zero")).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "10001" } });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Amount cannot exceed this policy's coverage")).toBeInTheDocument();
  });

  it("keeps incident values when navigating Back and Next", async () => {
    const user = userEvent.setup();
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Upload documents" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Incident type")).toHaveValue("Vehicle collision");
    expect(screen.getByLabelText("Describe what happened")).toHaveValue("The vehicle was damaged in a collision.");
    expect(screen.getByLabelText("Estimated claim amount")).toHaveValue(2500);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Upload documents" })).toBeInTheDocument();
  });

  it("disables Submit claim while the claim request is pending", async () => {
    const user = userEvent.setup();
    const request = deferred<{ data: { claim: typeof claim } }>();
    vi.mocked(apiClient.post).mockReturnValueOnce(request.promise as never);
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const submit = screen.getByRole("button", { name: "Submit claim" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    request.resolve({ data: { claim } });
    expect(await screen.findByText("Claim details")).toBeInTheDocument();
  });

  it("shows a partial-failure message when document upload fails after filing", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (url === "/api/claims") return { data: { claim } } as never;
      if (url === "/api/claims/claim-1/documents") throw new Error("upload failed");
      throw new Error(`Unexpected API request: ${url}`);
    });
    renderClaimForm();
    await openIncidentStep(user);
    await fillValidIncident(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    const file = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Supporting documents (optional)"), {
      target: { files: [file] },
    });
    expect(screen.getByText("receipt.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Submit claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Claim filed. These files could not be uploaded and can be added later: receipt.pdf.",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/claims/claim-1");
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  });
});
