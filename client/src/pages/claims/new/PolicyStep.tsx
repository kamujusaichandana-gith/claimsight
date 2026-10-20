import type { Policy } from "../../../types";
import { EmptyState } from "../../../components/ui";

function policyTypeLabel(type: Policy["type"]): string {
  return `${type.charAt(0)}${type.slice(1).toLowerCase()}`;
}

function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "Coverage amount unavailable";
}

export function PolicyStep({
  policies,
  policyId,
  error,
  onSelect,
}: {
  policies: Policy[];
  policyId: string;
  error?: string;
  onSelect: (policyId: string) => void;
}) {
  if (policies.length === 0) {
    return (
      <EmptyState
        title="No active policies"
        description="You need an active policy to file a claim. Once an active policy is available on your account, you can come back to start a claim."
      />
    );
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Choose the policy for this claim</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {policies.map((policy) => (
          <label
            key={policy.id}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-teal-700 ${
              policyId === policy.id ? "border-teal-700 bg-teal-50/60" : "border-slate-200 hover:border-teal-300"
            }`}
          >
            <input
              type="radio"
              name="policyId"
              value={policy.id}
              checked={policyId === policy.id}
              onChange={() => onSelect(policy.id)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "policyId-error" : undefined}
              className="mt-1 size-4 accent-teal-800"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {policyTypeLabel(policy.type)} policy
              </span>
              <span className="mt-1 block font-semibold text-slate-950">{policy.policyNumber}</span>
              <span className="mt-1 block text-sm text-slate-600">
                Coverage up to {formatMoney(policy.coverageAmount)}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {policy.startDate.slice(0, 10)} – {policy.endDate.slice(0, 10)}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id="policyId-error" className="mt-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
