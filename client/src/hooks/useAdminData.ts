import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type {
  AdminClaimDetails,
  AdminClaimListItem,
  ClaimStatistics,
  ClaimStatus,
  Pagination,
  PolicyType,
} from "../types";

export interface AdminClaimQueryParams {
  status?: ClaimStatus;
  policyType?: PolicyType;
  search?: string;
  sortBy: "createdAt" | "updatedAt" | "incidentDate" | "amount" | "status" | "claimNumber";
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const response = await apiClient.get<ClaimStatistics>("/api/admin/stats");
      return response.data;
    },
  });
}

export function useAdminClaims(params: AdminClaimQueryParams) {
  return useQuery({
    queryKey: ["admin", "claims", params],
    queryFn: async () => {
      const response = await apiClient.get<{
        items: AdminClaimListItem[];
        pagination: Pagination;
      }>("/api/admin/claims", { params });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminClaim(id: string) {
  return useQuery({
    queryKey: ["admin", "claim", id],
    queryFn: async () => {
      const response = await apiClient.get<{ claim: AdminClaimDetails }>(
        `/api/admin/claims/${encodeURIComponent(id)}`,
      );
      return response.data.claim;
    },
    enabled: Boolean(id),
  });
}
