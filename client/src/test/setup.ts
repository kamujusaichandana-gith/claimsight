import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const mockedApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api/client", () => ({
  AUTH_TOKEN_KEY: "test-auth-token",
  apiClient: mockedApiClient,
}));

import { apiClient } from "../api/client";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiClient.get).mockRejectedValue(new Error("Unexpected API call in test"));
  vi.mocked(apiClient.post).mockRejectedValue(new Error("Unexpected API call in test"));
  vi.mocked(apiClient.patch).mockRejectedValue(new Error("Unexpected API call in test"));
  vi.mocked(apiClient.delete).mockRejectedValue(new Error("Unexpected API call in test"));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected fetch in test")));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
