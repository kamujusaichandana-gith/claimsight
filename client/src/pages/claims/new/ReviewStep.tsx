import type { ReactNode } from "react";
import type { Policy } from "../../../types";
import type { ClaimFormInput } from "./schema";

function formatMoney(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "—";
}

export function ReviewStep({
  values,
  policy,
  files,
  onEdit,
}: {
  values: ClaimFormInput;
  policy?: Policy;
  files: File[];
  onEdit: (step: number) => void;
}) {
  return (
    <div className="grid gap-5">
      <ReviewSection title="Policy" step={0} onEdit={onEdit}>
        <p className="font-semibold text-slate-900">{policy?.policyNumber ?? "Policy not selected"}</p>
        <p className="mt-1 text-sm text-slate-600">{policy?.type.toLowerCase()} policy</p>
      </ReviewSection>
      <ReviewSection title="Incident details" step={1} onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Incident date</dt><dd className="mt-1 text-sm font-medium text-slate-900">{values.incidentDate}</dd></div>
          <div><dt className="text-xs text-slate-500">Incident type</dt><dd className="mt-1 text-sm font-medium text-slate-900">{values.incidentType}</dd></div>
          <div><dt className="text-xs text-slate-500">Estimated amount</dt><dd className="mt-1 text-sm font-medium text-slate-900">{formatMoney(values.amount)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{values.description}</dd></div>
        </dl>
      </ReviewSection>
      <ReviewSection title="Supporting documents" step={2} onEdit={onEdit}>
        {files.length === 0 ? (
          <p className="text-sm text-slate-600">No documents selected</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-800">
            {files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>)}
          </ul>
        )}
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="rounded-md text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        >
          Edit <span className="sr-only">{title}</span>
        </button>
      </div>
      {children}
    </section>
  );
}
