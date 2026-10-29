import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authContext } from "../auth/auth-context";
import type { AuthContextValue } from "../auth/auth-context";
import type { AdminClaimDetails, Claim, Policy, User } from "../types";

export const customer: User = {
  id: "customer-1",
  name: "Avery Brooks",
  email: "avery@example.test",
  role: "CUSTOMER",
  createdAt: "2025-01-01T00:00:00.000Z",
};

export const admin: User = {
  ...customer,
  id: "admin-1",
  name: "Alex Admin",
  email: "admin@example.test",
  role: "ADMIN",
};

export const policy: Policy = {
  id: "policy-1",
  policyNumber: "AUTO-1001",
  type: "AUTO",
  coverageAmount: "10000",
  premium: "120.50",
  startDate: "2020-01-01T00:00:00.000Z",
  endDate: "2035-12-31T00:00:00.000Z",
  status: "ACTIVE",
  userId: customer.id,
};

export const claim: Claim = {
  id: "claim-1",
  claimNumber: "CLM-1001",
  policyId: policy.id,
  userId: customer.id,
  incidentDate: "2025-03-04T00:00:00.000Z",
  incidentType: "Vehicle collision",
  description: "The vehicle was damaged in a collision.",
  amount: "1234.50",
  status: "SUBMITTED",
  createdAt: "2025-03-05T00:00:00.000Z",
  updatedAt: "2025-03-05T00:00:00.000Z",
};

export const adminClaim: AdminClaimDetails = {
  ...claim,
  comments: [],
  documents: [],
  statusHistory: [],
  user: { id: customer.id, name: customer.name, email: customer.email },
  policy: { policyNumber: policy.policyNumber, type: policy.type },
};

export function createFakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    isLoading: false,
    login: async () => customer,
    register: async () => customer,
    logout: () => undefined,
    ...overrides,
  };
}

export function renderWithProviders(
  ui: ReactNode,
  {
    auth = createFakeAuth(),
    initialEntries = ["/"],
  }: {
    auth?: AuthContextValue;
    initialEntries?: string[];
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <authContext.Provider value={auth}>
          <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </authContext.Provider>
      </QueryClientProvider>,
    ),
  };
}

export function mockGetResponses(responses: Record<string, unknown>) {
  return async (url: string) => {
    if (!(url in responses)) throw new Error(`Unexpected API request: ${url}`);
    return { data: responses[url] } as never;
  };
}
