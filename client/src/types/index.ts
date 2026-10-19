export type UserRole = "CUSTOMER" | "ADMIN";

export type PolicyType = "AUTO" | "HOME" | "HEALTH" | "TRAVEL";

export type PolicyStatus = "ACTIVE" | "EXPIRED";

export type ClaimStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  type: PolicyType;
  coverageAmount: string;
  premium: string;
  startDate: string;
  endDate: string;
  status: PolicyStatus;
  userId: string;
}

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  userId: string;
  incidentDate: string;
  incidentType: string;
  description: string;
  amount: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimComment {
  id: string;
  claimId: string;
  authorId: string;
  message: string;
  createdAt: string;
}

export interface ClaimDocument {
  id: string;
  claimId: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;
}

export interface ClaimStatusHistory {
  id: string;
  claimId: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  changedById: string;
  createdAt: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
}

export interface PolicySummary {
  policyNumber: string;
  type: PolicyType;
}

export interface ClaimCommentWithAuthor extends ClaimComment {
  author: Pick<UserSummary, "id" | "name">;
}

export interface ClaimStatusHistoryWithChanger extends ClaimStatusHistory {
  changedBy: Pick<UserSummary, "id" | "name">;
}

export interface ClaimDetails extends Claim {
  comments: ClaimCommentWithAuthor[];
  documents: ClaimDocument[];
  statusHistory: ClaimStatusHistoryWithChanger[];
}

export interface AdminClaimListItem extends Claim {
  user: UserSummary;
  policy: PolicySummary;
}

export interface AdminClaimDetails extends ClaimDetails {
  user: UserSummary;
  policy: PolicySummary;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination?: Pagination;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ClaimStatistics {
  claimsByStatus: Array<{
    status: ClaimStatus;
    count: number;
  }>;
  claimsPerMonth: Array<{
    month: string;
    count: number;
  }>;
}
