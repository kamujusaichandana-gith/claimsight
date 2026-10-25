import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { apiClient } from "../api/client";
import { ClaimDocumentDownload } from "../components/ClaimDocumentDownload";
import { Badge, Button, Card, EmptyState, ErrorMessage, Spinner } from "../components/ui";
import { useAdminClaim, useAdminClaimSummary, useAdminClaims, useAdminStats } from "../hooks/useAdminData";
import type { AdminClaimDetails, ClaimStatus, ClaimSummary, PolicyType } from "../types";

const statuses: ClaimStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAID"];
const statusLabels: Record<ClaimStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};
const policyTypes: PolicyType[] = ["AUTO", "HOME", "HEALTH", "TRAVEL"];
const sortFields = [
  { value: "createdAt", label: "Submitted date" },
  { value: "updatedAt", label: "Last updated" },
  { value: "incidentDate", label: "Incident date" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
  { value: "claimNumber", label: "Claim number" },
] as const;
type SortField = (typeof sortFields)[number]["value"];
const validSortFields = new Set<string>(sortFields.map(({ value }) => value));
const validStatuses = new Set<string>(statuses);
const validPolicyTypes = new Set<string>(policyTypes);
const nextStatuses: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const summaryDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatMonth(value: string): string {
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : monthFormatter.format(date);
}

function policyTypeLabel(type: PolicyType): string {
  return `${type.charAt(0)}${type.slice(1).toLowerCase()}`;
}

function readableApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  }
  return fallback;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
    </header>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorMessage message={message} />
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ClaimChartEmpty({ description }: { description: string }) {
  return <EmptyState title="No claims to chart yet" description={description} headingLevel={3} />;
}

export function AdminDashboardPage() {
  const query = useAdminStats();
  const heading = (
    <PageHeading
      eyebrow="ClaimsSight team"
      title="Claims dashboard"
      description="Track claims activity, monitor status progress, and open a claim for review."
    />
  );
  if (query.isPending) return <div className="space-y-8">{heading}<Spinner label="Loading claims dashboard" /></div>;
  if (query.isError) {
    return <div className="space-y-8">{heading}<RetryError message="We couldn't load claim statistics. Please try again." onRetry={() => void query.refetch()} /></div>;
  }

  const statusCounts = new Map(query.data.claimsByStatus.map(({ status, count }) => [status, count]));
  const chartStatuses = statuses.map((status) => ({
    status: statusLabels[status],
    count: statusCounts.get(status) ?? 0,
  }));
  const totalClaims = chartStatuses.reduce((total, item) => total + item.count, 0);
  const monthlyClaims = query.data.claimsPerMonth.map(({ month, count }) => ({
    month: formatMonth(month),
    count,
  }));
  const statItems = [
    { label: "Total claims", count: totalClaims },
    ...statuses.map((status) => ({ label: statusLabels[status], count: statusCounts.get(status) ?? 0 })),
  ];

  return (
    <div className="space-y-8">
      {heading}
      <section aria-label="Claim totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statItems.map((item) => (
          <Card key={item.label}>
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{item.count}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Claim charts">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Claims by status</h2>
          <p className="mt-1 text-sm text-slate-500">Claim counts for each current status.</p>
          {totalClaims === 0 ? (
            <ClaimChartEmpty description="Status totals will appear here when claims are submitted." />
          ) : (
            <div className="mt-5 h-72 w-full" role="img" aria-label="Bar chart showing claims by status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartStatuses} margin={{ top: 8, right: 12, bottom: 52, left: 0 }} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" angle={-25} textAnchor="end" interval={0} height={68} tick={{ fontSize: 11 }} label={{ value: "Claim status", position: "insideBottom", offset: -10 }} />
                  <YAxis allowDecimals={false} width={52} label={{ value: "Claims", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value) => [value, "Claims"]} />
                  <Bar dataKey="count" name="Claims" fill="#0f766e" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="sr-only">Horizontal axis: claim status. Vertical axis: number of claims.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Claims per month</h2>
          <p className="mt-1 text-sm text-slate-500">Claims created in the last six calendar months.</p>
          {monthlyClaims.every(({ count }) => count === 0) ? (
            <ClaimChartEmpty description="Monthly totals will appear here when claims are submitted." />
          ) : (
            <div className="mt-5 h-72 w-full" role="img" aria-label="Bar chart showing claims created per month">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyClaims} margin={{ top: 8, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: "Month", position: "insideBottom", offset: -5 }} />
                  <YAxis allowDecimals={false} width={52} label={{ value: "Claims", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value) => [value, "Claims"]} />
                  <Bar dataKey="count" name="Claims" fill="#115e59" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="sr-only">Horizontal axis: month. Vertical axis: number of claims.</p>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">All claims</h2>
          <p className="mt-1 text-sm text-slate-500">Search and sort claims, then open one to review details.</p>
        </div>
        <Link to="/admin/claims"><Button variant="outline">Open claims list</Button></Link>
      </div>
      <AdminClaimsTable />
    </div>
  );
}

function AdminClaimsPageHeading() {
  return (
    <PageHeading
      eyebrow="ClaimsSight team"
      title="All claims"
      description="Search by claim number or customer name, filter the queue, and open a claim for review."
    />
  );
}

function AdminClaimsPage() {
  return (
    <div className="space-y-7">
      <AdminClaimsPageHeading />
      <AdminClaimsTable />
    </div>
  );
}

function AdminClaimsTable() {
  const [searchParams] = useSearchParams();
  const searchValue = searchParams.get("search") ?? "";
  return <AdminClaimsTableContent key={searchValue} searchValue={searchValue} />;
}

function AdminClaimsTableContent({ searchValue }: { searchValue: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status") ?? "";
  const policyTypeParam = searchParams.get("policyType") ?? "";
  const status = validStatuses.has(statusParam) ? statusParam as ClaimStatus : undefined;
  const policyType = validPolicyTypes.has(policyTypeParam) ? policyTypeParam as PolicyType : undefined;
  const sortParam = searchParams.get("sortBy") ?? "";
  const sortBy: SortField = validSortFields.has(sortParam) ? sortParam as SortField : "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const parsedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number(searchParams.get("limit"));
  const limit = [10, 25, 50].includes(parsedLimit) ? parsedLimit : 10;
  const [searchInput, setSearchInput] = useState(searchValue);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === searchValue) return;
      const next = new URLSearchParams(searchParams);
      if (trimmed) next.set("search", trimmed);
      else next.delete("search");
      next.delete("page");
      setSearchParams(next);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput, searchValue, searchParams, setSearchParams]);

  const claims = useAdminClaims({
    ...(status ? { status } : {}),
    ...(policyType ? { policyType } : {}),
    ...(searchValue ? { search: searchValue } : {}),
    sortBy,
    order,
    page,
    limit,
  });

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  return (
    <section aria-label="All claims table" className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <label htmlFor="admin-claim-search" className="text-sm font-medium text-slate-700">Search claims</label>
            <input
              id="admin-claim-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Claim number or customer"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="admin-claim-status">
            Status
            <select
              id="admin-claim-status"
              value={status ?? ""}
              onChange={(event) => updateParams({ status: event.target.value || undefined, page: undefined })}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            >
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="admin-claim-policy">
            Policy type
            <select
              id="admin-claim-policy"
              value={policyType ?? ""}
              onChange={(event) => updateParams({ policyType: event.target.value || undefined, page: undefined })}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            >
              <option value="">All policy types</option>
              {policyTypes.map((item) => <option key={item} value={item}>{policyTypeLabel(item)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="admin-claim-sort">
            Sort by
            <select
              id="admin-claim-sort"
              value={sortBy}
              onChange={(event) => updateParams({ sortBy: event.target.value, order: "desc", page: undefined })}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            >
              {sortFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => updateParams({ order: order === "asc" ? "desc" : "asc", page: undefined })}>
            Sort order: {order === "asc" ? "Ascending" : "Descending"}
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Rows per page
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(event) => updateParams({ limit: event.target.value, page: undefined })}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/10"
            >
              {[10, 25, 50].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {claims.isPending ? <Spinner label="Loading claims" /> : claims.isError ? (
        <RetryError message="We couldn't load claims. Please try again." onRetry={() => void claims.refetch()} />
      ) : claims.data.items.length === 0 ? (
        <Card><EmptyState
          title="No matching claims"
          description={searchValue || status || policyType ? "Try changing the search or filters." : "Claims will appear here when customers submit them."}
        /></Card>
      ) : (
        <Card padded={false}>
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            role="region"
            aria-label="Claims results table"
            tabIndex={0}
          >
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">Claims submitted by customers</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Claim number</th>
                  <th scope="col" className="px-5 py-3">Customer</th>
                  <th scope="col" className="px-5 py-3">Policy type</th>
                  <th scope="col" className="px-5 py-3">Amount</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.data.items.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50">
                    <th scope="row" className="px-5 py-4 font-semibold">
                      <Link to={`/admin/claims/${encodeURIComponent(claim.id)}`} className="text-teal-900 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
                        {claim.claimNumber}
                      </Link>
                    </th>
                    <td className="px-5 py-4 text-slate-700">{claim.user.name}</td>
                    <td className="px-5 py-4 text-slate-700">{policyTypeLabel(claim.policy.type)}</td>
                    <td className="px-5 py-4 text-slate-700">{formatMoney(claim.amount)}</td>
                    <td className="px-5 py-4"><Badge status={claim.status} /></td>
                    <td className="px-5 py-4 text-slate-700">{formatDate(claim.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-600" aria-live="polite">
              Page {claims.data.pagination.page} of {Math.max(claims.data.pagination.totalPages, 1)} · {claims.data.pagination.total} {claims.data.pagination.total === 1 ? "claim" : "claims"}
              {claims.isFetching && <span className="sr-only"> Updating results</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1 || claims.isFetching} onClick={() => updateParams({ page: String(page - 1) })}>Previous</Button>
              <Button variant="outline" disabled={page >= claims.data.pagination.totalPages || claims.isFetching} onClick={() => updateParams({ page: String(page + 1) })}>Next</Button>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>;
}

function ClaimTimeline({ claim }: { claim: AdminClaimDetails }) {
  const history = [...claim.statusHistory].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return (
    <ol className="space-y-0" aria-label="Claim status timeline">
      {history.length === 0 ? (
        <li className="text-sm text-slate-500">No status history is available.</li>
      ) : history.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < history.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200" aria-hidden="true" />}
          <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-teal-700 bg-teal-50 text-xs font-bold text-teal-800" aria-hidden="true">✓</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {entry.fromStatus ? `${statusLabels[entry.fromStatus]} → ${statusLabels[entry.toStatus]}` : statusLabels[entry.toStatus]}
              </p>
              <time className="text-xs text-slate-500" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
            </div>
            <p className="mt-1 text-xs text-slate-500">Updated by {entry.changedBy.name}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function AdminClaimSummaryPanel({ claimId }: { claimId: string }) {
  const queryClient = useQueryClient();
  const summaryQuery = useAdminClaimSummary(claimId);
  const summaryMutation = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const response = await apiClient.post<ClaimSummary>(
        `/api/admin/claims/${encodeURIComponent(claimId)}/summary`,
        { regenerate },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "claim-summary", claimId] });
    },
  });

  return (
    <Card className="h-fit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">AI summary</h2>
        {summaryQuery.data?.enabled && (
          <Button
            variant={summaryQuery.data.summary ? "outline" : "primary"}
            disabled={summaryMutation.isPending}
            onClick={() => summaryMutation.mutate(Boolean(summaryQuery.data?.summary))}
          >
            {summaryMutation.isPending
              ? <><Spinner label={summaryQuery.data.summary ? "Regenerating summary" : "Generating summary"} />Generating…</>
              : summaryQuery.data.summary ? "Regenerate" : "Generate"}
          </Button>
        )}
      </div>

      {summaryQuery.isPending && <div className="mt-4"><Spinner label="Loading AI summary" /></div>}
      {summaryQuery.isError && (
        <div className="mt-4">
          <RetryError
            message={readableApiError(summaryQuery.error, "We couldn't load the AI summary. The rest of the claim review is still available.")}
            onRetry={() => void summaryQuery.refetch()}
          />
        </div>
      )}
      {summaryQuery.data && !summaryQuery.data.enabled && (
        <p className="mt-4 text-sm leading-6 text-slate-600">AI summaries are currently disabled.</p>
      )}
      {summaryMutation.isError && (
        <div className="mt-4">
          <ErrorMessage message={readableApiError(summaryMutation.error, "We couldn't generate an AI summary. Please try again.")} />
        </div>
      )}
      {summaryQuery.data?.summary && (
        <div className="mt-4 space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{summaryQuery.data.summary.summary}</p>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested category</dt>
              <dd className="mt-1 font-medium text-slate-900">{summaryQuery.data.summary.suggestedCategory}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</dt>
              <dd className="mt-1 font-medium text-slate-900">{summaryQuery.data.summary.urgency}</dd>
            </div>
          </dl>
          {summaryQuery.data.generatedAt && (
            <time className="block text-xs text-slate-500" dateTime={summaryQuery.data.generatedAt}>
              Generated {summaryDateFormatter.format(new Date(summaryQuery.data.generatedAt))}
            </time>
          )}
        </div>
      )}
      <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        This summary is AI-generated and must be reviewed by a person.
      </p>
    </Card>
  );
}

const commentSchema = z.object({
  message: z.string().trim().min(1, "Enter a comment.").max(5000, "Comments must be 5,000 characters or fewer."),
});

function ClaimReviewPage() {
  const { id = "" } = useParams();
  const claimQuery = useAdminClaim(id);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentNotice, setCommentNotice] = useState("");
  const [statusError, setStatusError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<ClaimStatus | null>(null);
  const [mutationNotice, setMutationNotice] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const invalidateAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "claim", id] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "claims"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] }),
    ]);
  };

  const commentMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiClient.post(`/api/admin/claims/${encodeURIComponent(id)}/comments`, { message });
    },
    onSuccess: async () => {
      setComment("");
      setCommentError("");
      setCommentNotice("Your comment was added.");
      await invalidateAdminData();
    },
    onError: (error: unknown) => {
      setCommentError(readableApiError(error, "We couldn't add your comment. Please try again."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: ClaimStatus) => {
      await apiClient.patch(`/api/admin/claims/${encodeURIComponent(id)}/status`, { status });
    },
    onSuccess: async () => {
      setStatusError("");
      setMutationNotice("Claim status updated.");
      await invalidateAdminData();
    },
    onError: async (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        setStatusError("This status change is no longer valid. The claim has been refreshed; review its current status and try again.");
        await queryClient.invalidateQueries({ queryKey: ["admin", "claim", id] });
        return;
      }
      setStatusError(readableApiError(error, "We couldn't update the claim status. Please try again."));
    },
  });

  useEffect(() => {
    if (!pendingStatus) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = () => Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    focusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingStatus(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeDialog = dialogRef.current;
      if (!activeDialog) return;
      if (!activeDialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function handleFocusIn(event: FocusEvent) {
      const activeDialog = dialogRef.current;
      if (activeDialog && event.target instanceof Node && !activeDialog.contains(event.target)) {
        focusable()[0]?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      if (openerRef.current?.isConnected) openerRef.current.focus();
      openerRef.current = null;
    };
  }, [pendingStatus]);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = commentSchema.safeParse({ message: comment });
    if (!result.success) {
      setCommentError(result.error.issues[0]?.message ?? "Enter a valid comment.");
      setCommentNotice("");
      return;
    }
    setCommentError("");
    setCommentNotice("");
    commentMutation.mutate(result.data.message);
  }

  function requestStatusChange(status: ClaimStatus, event: React.MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setStatusError("");
    setMutationNotice("");
    setPendingStatus(status);
  }

  function confirmStatusChange() {
    if (!pendingStatus) return;
    const targetStatus = pendingStatus;
    setPendingStatus(null);
    statusMutation.mutate(targetStatus);
  }

  if (claimQuery.isPending) {
    return (
      <div className="space-y-7">
        <PageHeading eyebrow="Claim review" title="Claim review" description="Loading claim details for review." />
        <Spinner label="Loading claim review" />
      </div>
    );
  }
  if (claimQuery.isError) {
    return (
      <div className="space-y-5">
        <PageHeading eyebrow="Claim review" title="Claim review" description="Review the information, supporting documents, and status history for this customer claim." />
        <Link to="/admin/claims" className="text-sm font-semibold text-teal-800 hover:text-teal-950">← Back to all claims</Link>
        <RetryError message={readableApiError(claimQuery.error, "We couldn't load this claim. Please try again.")} onRetry={() => void claimQuery.refetch()} />
      </div>
    );
  }
  const claim = claimQuery.data;
  const availableStatuses = nextStatuses[claim.status] ?? [];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/claims" className="text-sm font-semibold text-teal-800 hover:text-teal-950">← Back to all claims</Link>
          <PageHeading
            eyebrow="Claim review"
            title={claim.claimNumber}
            description={`${claim.incidentType} · submitted ${formatDate(claim.createdAt)}`}
          />
        </div>
        <Badge status={claim.status} />
      </div>

      {(statusError || mutationNotice) && (
        <div className="space-y-3" aria-live="polite">
          {statusError && <ErrorMessage message={statusError} />}
          {mutationNotice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{mutationNotice}</p>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Claim details</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{claim.claimNumber}</h2>
              </div>
              <Badge status={claim.status} />
            </div>
            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <DetailField label="Claim amount" value={formatMoney(claim.amount)} />
              <DetailField label="Incident date" value={formatDate(claim.incidentDate)} />
              <DetailField label="Submitted" value={formatDate(claim.createdAt)} />
              <DetailField label="Policy" value={`${policyTypeLabel(claim.policy.type)} · ${claim.policy.policyNumber}`} />
            </dl>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{claim.description}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Customer details</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailField label="Name" value={claim.user.name} />
              <DetailField label="Email" value={claim.user.email ?? "Not provided"} />
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Uploaded documents</h2>
            {claim.documents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No documents have been added to this claim.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {claim.documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div>
                      <span className="break-all text-sm font-medium text-slate-800">{document.fileName}</span>
                      <time className="ml-2 text-xs text-slate-500" dateTime={document.uploadedAt}>Uploaded {formatDate(document.uploadedAt)}</time>
                    </div>
                    <ClaimDocumentDownload
                      claimId={claim.id}
                      documentId={document.id}
                      fileName={document.fileName}
                      routePrefix="/api/admin/claims"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Comments</h2>
            {claim.comments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">There are no comments on this claim yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {claim.comments.map((item) => (
                  <li key={item.id} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.author.name}</p>
                      <time className="text-xs text-slate-500" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
            <form className="mt-6 border-t border-slate-100 pt-5" onSubmit={submitComment} noValidate>
              <label htmlFor="admin-comment" className="text-sm font-semibold text-slate-900">Add a comment</label>
              <textarea
                id="admin-comment"
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  if (commentError) setCommentError("");
                  if (commentNotice) setCommentNotice("");
                }}
                rows={4}
                maxLength={5000}
                disabled={commentMutation.isPending}
                aria-invalid={Boolean(commentError)}
                aria-describedby={commentError ? "admin-comment-error" : "admin-comment-count"}
                className={`mt-2 block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${commentError ? "border-rose-400" : "border-slate-200"}`}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                {commentError
                  ? <p id="admin-comment-error" className="text-sm text-rose-700" role="alert">{commentError}</p>
                  : <p id="admin-comment-count" className="text-xs text-slate-500">{comment.length}/5000 characters</p>}
                <Button type="submit" disabled={commentMutation.isPending}>
                  {commentMutation.isPending ? <><Spinner label="Adding comment" />Adding…</> : "Add comment"}
                </Button>
              </div>
              {commentNotice && <p className="mt-3 text-sm text-emerald-800" role="status">{commentNotice}</p>}
            </form>
          </Card>
        </div>

        <aside className="space-y-5">
          <AdminClaimSummaryPanel claimId={claim.id} />
          <Card className="h-fit">
            <h2 className="mb-5 text-lg font-semibold text-slate-950">Status timeline</h2>
            <ClaimTimeline claim={claim} />
          </Card>
          <Card className="h-fit">
            <h2 className="text-lg font-semibold text-slate-950">Review actions</h2>
            {availableStatuses.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This claim is {statusLabels[claim.status].toLowerCase()} and its status is final. No further status changes are available.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {availableStatuses.map((status) => (
                  <Button key={status} variant={status === "REJECTED" ? "outline" : "primary"} disabled={statusMutation.isPending} onClick={(event) => requestStatusChange(status, event)}>
                    {status === "UNDER_REVIEW" ? "Move to under review" : status === "APPROVED" ? "Approve claim" : status === "REJECTED" ? "Reject claim" : "Mark as paid"}
                  </Button>
                ))}
              </div>
            )}
            {statusMutation.isPending && <div className="mt-4"><Spinner label="Updating claim status" /></div>}
          </Card>
        </aside>
      </div>

      {pendingStatus && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPendingStatus(null);
        }}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-dialog-title"
            aria-describedby="status-dialog-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="status-dialog-title" className="text-xl font-semibold text-slate-950">Confirm status change</h2>
            <p id="status-dialog-description" className="mt-3 text-sm leading-6 text-slate-600">
              Change this claim from {statusLabels[claim.status]} to {statusLabels[pendingStatus]}? This will be added to the claim timeline.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setPendingStatus(null)}>Cancel</Button>
              <Button onClick={confirmStatusChange} disabled={statusMutation.isPending}>
                {statusMutation.isPending ? "Updating…" : "Confirm change"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminClaimsPage, ClaimReviewPage };
