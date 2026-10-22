import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button, Card, EmptyState, ErrorMessage, Spinner, Badge, Toast } from "../components/ui";
import { useClaim, useClaims, usePolicies, usePolicy } from "../hooks/useCustomerData";
import type { Claim, ClaimStatus, Policy, PolicyStatus, PolicyType } from "../types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
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

function getErrorMessage(error: unknown, resource: string): string {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return `${resource} not found. It may have been removed or is not available to your account.`;
  }

  return `We couldn't load ${resource.toLowerCase()}. Please try again.`;
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

function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  const styles: Record<PolicyStatus, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
    EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}

function policyTypeLabel(type: PolicyType): string {
  return `${type.charAt(0)}${type.slice(1).toLowerCase()}`;
}

function PolicyCard({ policy }: { policy: Policy }) {
  return (
    <Link
      to={`/policies/${encodeURIComponent(policy.id)}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-colors hover:border-teal-200 hover:shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{policyTypeLabel(policy.type)} policy</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{policy.policyNumber}</h2>
          </div>
          <PolicyStatusBadge status={policy.status} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Coverage</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatMoney(policy.coverageAmount)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Premium</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatMoney(policy.premium)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Effective</dt>
            <dd className="mt-1 text-slate-800">{formatDate(policy.startDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Expires</dt>
            <dd className="mt-1 text-slate-800">{formatDate(policy.endDate)}</dd>
          </div>
        </dl>
        <span className="mt-5 inline-flex text-sm font-semibold text-teal-800">View policy details <span aria-hidden="true" className="ml-1">→</span></span>
      </Card>
    </Link>
  );
}

function DashboardPage() {
  const policies = usePolicies();
  const claims = useClaims({
    sortBy: "createdAt",
    order: "desc",
    page: 1,
    limit: 5,
  });
  const submittedClaims = useClaims({
    status: "SUBMITTED",
    sortBy: "createdAt",
    order: "desc",
    page: 1,
    limit: 1,
  });
  const reviewClaims = useClaims({
    status: "UNDER_REVIEW",
    sortBy: "createdAt",
    order: "desc",
    page: 1,
    limit: 1,
  });
  const heading = (
    <PageHeading
      eyebrow="Your insurance, made simple"
      title="Your ClaimSight dashboard"
      description="A clear view of your coverage and the latest activity on your claims."
    />
  );

  if (policies.isPending || claims.isPending || submittedClaims.isPending || reviewClaims.isPending) {
    return <div className="space-y-8">{heading}<Spinner label="Loading your dashboard" /></div>;
  }
  if (policies.isError) return <div className="space-y-8">{heading}<ErrorMessage message={getErrorMessage(policies.error, "your dashboard")} /></div>;
  if (claims.isError) return <div className="space-y-8">{heading}<ErrorMessage message={getErrorMessage(claims.error, "your dashboard")} /></div>;
  if (submittedClaims.isError) return <div className="space-y-8">{heading}<ErrorMessage message={getErrorMessage(submittedClaims.error, "your dashboard")} /></div>;
  if (reviewClaims.isError) return <div className="space-y-8">{heading}<ErrorMessage message={getErrorMessage(reviewClaims.error, "your dashboard")} /></div>;

  const activePolicies = policies.data.filter((policy) => policy.status === "ACTIVE").length;
  const openClaims =
    submittedClaims.data.pagination.total + reviewClaims.data.pagination.total;
  const recentClaims = claims.data?.items ?? [];

  return (
    <div className="space-y-8">
      {heading}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-slate-500">Active policies</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{activePolicies}</p>
          <Link to="/policies" className="mt-4 inline-flex text-sm font-semibold text-teal-800 hover:text-teal-950">View policies</Link>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Open claims</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{openClaims}</p>
          <Link to="/claims" className="mt-4 inline-flex text-sm font-semibold text-teal-800 hover:text-teal-950">View claims</Link>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/claims/new"><Button>File a claim</Button></Link>
        <Link to="/policies"><Button variant="outline">View policies</Button></Link>
      </div>
      <section aria-labelledby="recent-claims-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-800">Latest activity</p>
            <h2 id="recent-claims-heading" className="mt-1 text-xl font-semibold text-slate-950">Recent claims</h2>
          </div>
          <Link to="/claims" className="text-sm font-semibold text-teal-800 hover:text-teal-950">All claims</Link>
        </div>
        <Card padded={false}>
          {recentClaims.length === 0 ? (
            <EmptyState title="No claims yet" description="When you file a claim, its latest updates will appear here." headingLevel={3} />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentClaims.map((claim) => <ClaimSummaryRow key={claim.id} claim={claim} />)}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function ClaimSummaryRow({ claim }: { claim: Claim }) {
  return (
    <Link to={`/claims/${encodeURIComponent(claim.id)}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50 sm:px-6">
      <div>
        <p className="font-semibold text-slate-900">{claim.claimNumber}</p>
        <p className="mt-1 text-sm text-slate-500">{claim.incidentType} · {formatDate(claim.createdAt)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">{formatMoney(claim.amount)}</span>
        <Badge status={claim.status} />
      </div>
    </Link>
  );
}

function PoliciesPage() {
  const policies = usePolicies();

  return (
    <div className="space-y-7">
      <PageHeading eyebrow="Your protection" title="My policies" description="See your coverage at a glance and open a policy for its full details." />
      {policies.isPending ? <Spinner label="Loading policies" /> : policies.isError ? (
        <ErrorMessage message={getErrorMessage(policies.error, "policies")} />
      ) : policies.data.length === 0 ? (
        <Card><EmptyState title="No policies to show" description="Your policies will appear here when they are available to your account." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.data.map((policy) => <PolicyCard key={policy.id} policy={policy} />)}
        </div>
      )}
    </div>
  );
}

function PolicyDetailsPage() {
  const { id = "" } = useParams();
  const query = usePolicy(id);
  const heading = (
    <PageHeading eyebrow="Your protection" title="Policy details" description="Your policy coverage, premium, and key dates in one place." />
  );

  if (query.isPending) return <div className="space-y-7">{heading}<Spinner label="Loading policy details" /></div>;
  if (query.isError) return <div className="space-y-7">{heading}<ErrorMessage message={getErrorMessage(query.error, "policy details")} /></div>;
  const policy = query.data;

  return (
    <div className="space-y-7">
      {heading}
      <Card className="max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">{policyTypeLabel(policy.type)} policy</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{policy.policyNumber}</h2>
          </div>
          <PolicyStatusBadge status={policy.status} />
        </div>
        <dl className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <DetailField label="Coverage amount" value={formatMoney(policy.coverageAmount)} />
          <DetailField label="Premium" value={formatMoney(policy.premium)} />
          <DetailField label="Start date" value={formatDate(policy.startDate)} />
          <DetailField label="End date" value={formatDate(policy.endDate)} />
        </dl>
        <Link to="/policies" className="mt-7 inline-flex text-sm font-semibold text-teal-800 hover:text-teal-950">← Back to policies</Link>
      </Card>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>;
}

const statuses: ClaimStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAID"];
const statusLabels: Record<ClaimStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

function ClaimTimeline({ claim }: { claim: ReturnType<typeof useClaim>["data"] }) {
  if (!claim) return null;
  const history = [...claim.statusHistory].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const completedStatuses = new Set(history.map((item) => item.toStatus));
  const timelineStatuses = statuses.filter((status) => {
    if (status === "REJECTED") return completedStatuses.has(status) || claim.status === status;
    if (status === "APPROVED" || status === "PAID") return completedStatuses.has(status) || claim.status === status;
    return true;
  });

  return (
    <ol className="space-y-0" aria-label="Claim status timeline">
      {timelineStatuses.map((status, index) => {
        const entry = history.find((item) => item.toStatus === status);
        const current = status === claim.status;
        const complete = completedStatuses.has(status);
        return (
          <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
            {index < timelineStatuses.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200" aria-hidden="true" />}
            <span className={`relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${current ? "border-teal-800 bg-teal-800 text-white" : complete ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-transparent"}`} aria-hidden="true">
              {complete || current ? "✓" : ""}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className={`text-sm ${current ? "font-bold text-teal-900" : complete ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                {statusLabels[status]}{current && <span className="sr-only"> (current status)</span>}
              </p>
              {entry && <time className="text-xs text-slate-500" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ClaimDetailsPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const [toastMessage, setToastMessage] = useState(() => {
    const state: unknown = location.state;
    if (typeof state !== "object" || state === null || !("claimToast" in state)) return null;
    return typeof state.claimToast === "string" ? state.claimToast : null;
  });
  const [toastTone, setToastTone] = useState<"success" | "error">(() => {
    const state: unknown = location.state;
    return typeof state === "object" && state !== null && "claimToastTone" in state && state.claimToastTone === "error"
      ? "error"
      : "success";
  });
  const notification = toastMessage ? (
    <Toast
      message={toastMessage}
      tone={toastTone}
      onClose={() => {
        setToastMessage(null);
        setToastTone("success");
      }}
    />
  ) : null;
  const query = useClaim(id);
  const heading = (
    <PageHeading eyebrow="Your claim" title="Claim details" description="Review your claim information, status updates, comments, and supporting documents." />
  );

  if (query.isPending) return <div className="space-y-7">{notification}{heading}<Spinner label="Loading claim details" /></div>;
  if (query.isError) return <div className="space-y-7">{notification}{heading}<ErrorMessage message={getErrorMessage(query.error, "claim details")} /></div>;
  const claim = query.data;

  return (
    <div className="space-y-7">
      {notification}
      {heading}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-sm text-slate-500">Claim reference</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{claim.claimNumber}</h2></div>
              <Badge status={claim.status} />
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailField label="Incident type" value={claim.incidentType} />
              <DetailField label="Claim amount" value={formatMoney(claim.amount)} />
              <DetailField label="Incident date" value={formatDate(claim.incidentDate)} />
              <DetailField label="Submitted" value={formatDate(claim.createdAt)} />
            </dl>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{claim.description}</p>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Comments</h2>
            {claim.comments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">There are no comments on this claim yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {claim.comments.map((comment) => (
                  <li key={comment.id} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{comment.author.name}</p>
                      <time className="text-xs text-slate-500" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Documents</h2>
            {claim.documents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No documents have been added to this claim.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {claim.documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <span className="break-all text-sm font-medium text-slate-800">{document.fileName}</span>
                    <time className="text-xs text-slate-500" dateTime={document.uploadedAt}>Uploaded {formatDate(document.uploadedAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <h2 className="mb-5 text-lg font-semibold text-slate-950">Status timeline</h2>
          <ClaimTimeline claim={claim} />
        </Card>
      </div>
      <Link to="/claims" className="inline-flex text-sm font-semibold text-teal-800 hover:text-teal-950">← Back to claims</Link>
    </div>
  );
}

const claimStatuses: Array<{ value: ClaimStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
];
const sortFields: Array<{ value: ClaimQuerySort; label: string }> = [
  { value: "createdAt", label: "Submitted date" },
  { value: "updatedAt", label: "Last updated" },
  { value: "incidentDate", label: "Incident date" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
  { value: "claimNumber", label: "Claim number" },
];
type ClaimQuerySort = "createdAt" | "updatedAt" | "incidentDate" | "amount" | "status" | "claimNumber";
const validSorts = new Set<ClaimQuerySort>(sortFields.map((field) => field.value));
const validStatuses = new Set<ClaimStatus>(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAID"]);

function ClaimsPage() {
  const [searchParams] = useSearchParams();
  const searchValue = searchParams.get("search") ?? "";
  return <ClaimsPageContent key={searchValue} searchValue={searchValue} />;
}

function ClaimsPageContent({ searchValue }: { searchValue: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status") ?? "";
  const status = validStatuses.has(statusParam as ClaimStatus) ? statusParam as ClaimStatus : undefined;
  const sortParam = searchParams.get("sortBy") as ClaimQuerySort | null;
  const sortBy = sortParam && validSorts.has(sortParam) ? sortParam : "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const parsedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [searchInput, setSearchInput] = useState(searchValue);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === searchValue) return;
      const next = new URLSearchParams(searchParams);
      if (searchInput.trim()) next.set("search", searchInput.trim());
      else next.delete("search");
      next.delete("page");
      setSearchParams(next);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput, searchValue, searchParams, setSearchParams]);

  const claims = useClaims({
    ...(status ? { status } : {}),
    ...(searchValue ? { search: searchValue } : {}),
    sortBy,
    order,
    page,
    limit: 10,
  });

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  function changeSort(field: ClaimQuerySort) {
    updateParams({
      sortBy: field,
      order: field === sortBy ? (order === "asc" ? "desc" : "asc") : "desc",
      page: undefined,
    });
  }

  return (
    <div className="space-y-7">
      <PageHeading eyebrow="We're here to help" title="My claims" description="Follow the progress of your claims and see updates from your claims team." />
      <Card>
        <div className="grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]">
          <div className="grid gap-1.5">
            <label htmlFor="claim-search" className="text-sm font-medium text-slate-700">Search claims</label>
            <input id="claim-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Claim number or incident" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="claim-status" className="text-sm font-medium text-slate-700">Filter by status</label>
            <select id="claim-status" value={status ?? ""} onChange={(event) => updateParams({ status: event.target.value || undefined, page: undefined })} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10">
              {claimStatuses.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="claim-sort" className="text-sm font-medium text-slate-700">Sort by</label>
            <select id="claim-sort" value={sortBy} onChange={(event) => updateParams({ sortBy: event.target.value, order: "desc", page: undefined })} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10">
              {sortFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {claims.isPending ? <Spinner label="Loading claims" /> : claims.isError ? (
        <ErrorMessage message={getErrorMessage(claims.error, "claims")} />
      ) : claims.data.items.length === 0 ? (
        <Card><EmptyState title="No matching claims" description={searchValue || status ? "Try changing your search or status filter." : "When you file a claim, it will appear here."} /></Card>
      ) : (
        <Card padded={false}>
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            role="region"
            aria-label="Claims results table"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Your claims and their current status</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3"><SortButton field="claimNumber" current={sortBy} order={order} onClick={changeSort}>Claim</SortButton></th>
                  <th scope="col" className="px-5 py-3">Incident</th>
                  <th scope="col" className="px-5 py-3"><SortButton field="incidentDate" current={sortBy} order={order} onClick={changeSort}>Incident date</SortButton></th>
                  <th scope="col" className="px-5 py-3"><SortButton field="amount" current={sortBy} order={order} onClick={changeSort}>Amount</SortButton></th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3"><SortButton field="createdAt" current={sortBy} order={order} onClick={changeSort}>Submitted</SortButton></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.data.items.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50">
                    <th scope="row" className="px-5 py-4 font-semibold"><Link to={`/claims/${encodeURIComponent(claim.id)}`} className="text-teal-900 underline-offset-4 hover:underline">{claim.claimNumber}</Link></th>
                    <td className="px-5 py-4 text-slate-700">{claim.incidentType}</td>
                    <td className="px-5 py-4 text-slate-700">{formatDate(claim.incidentDate)}</td>
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
    </div>
  );
}

function SortButton({ field, current, order, onClick, children }: { field: ClaimQuerySort; current: ClaimQuerySort; order: "asc" | "desc"; onClick: (field: ClaimQuerySort) => void; children: string }) {
  const active = field === current;
  return (
    <button type="button" onClick={() => onClick(field)} aria-label={`Sort by ${children}${active ? `, currently ${order === "asc" ? "ascending" : "descending"}` : ""}`} className="inline-flex items-center gap-1 font-semibold hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
      {children}<span aria-hidden="true">{active ? (order === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

export { ClaimsPage, ClaimDetailsPage, DashboardPage, PoliciesPage, PolicyDetailsPage };
