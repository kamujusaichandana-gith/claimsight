import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { Claim, ClaimDetails, ClaimStatus, Policy } from "../types";

export interface ClaimQueryParams {
  status?: ClaimStatus;
  search?: string;
  sortBy: "createdAt" | "updatedAt" | "incidentDate" | "amount" | "status" | "claimNumber";
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export function usePolicies() {
  return useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const response = await apiClient.get<{ items: Policy[] }>("/api/policies");
      return response.data.items;
    },
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: ["policies", id],
    queryFn: async () => {
      const response = await apiClient.get<{ policy: Policy }>(`/api/policies/${encodeURIComponent(id)}`);
      return response.data.policy;
    },
    enabled: Boolean(id),
  });
}

export function useClaims(params: ClaimQueryParams) {
  return useQuery({
    queryKey: ["claims", params],
    queryFn: async () => {
      const response = await apiClient.get<{
        items: Claim[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/api/claims", { params });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ["claims", id],
    queryFn: async () => {
      const response = await apiClient.get<{ claim: ClaimDetails }>(`/api/claims/${encodeURIComponent(id)}`);
      return response.data.claim;
    },
    enabled: Boolean(id),
  });
}
