import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "../../../components/ui";
import type { ClaimFormInput } from "./schema";

export function IncidentStep({
  register,
  errors,
  description,
  maxDate,
}: {
  register: UseFormRegister<ClaimFormInput>;
  errors: FieldErrors<ClaimFormInput>;
  description: string;
  maxDate: string;
}) {
  return (
    <div className="grid gap-5">
      <Input
        label="Incident date"
        type="date"
        max={maxDate}
        {...register("incidentDate")}
        error={errors.incidentDate?.message}
      />
      <Input
        label="Incident type"
        placeholder="For example, vehicle collision"
        {...register("incidentType")}
        error={errors.incidentType?.message}
      />
      <div className="grid gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-slate-700">
          Describe what happened
        </label>
        <textarea
          id="description"
          rows={5}
          maxLength={5000}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error description-count" : "description-count"}
          className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${
            errors.description ? "border-rose-400" : "border-slate-200"
          }`}
          placeholder="Include the key details of the incident."
          {...register("description")}
        />
        {errors.description && (
          <p id="description-error" className="text-xs text-rose-700" role="alert">
            {errors.description.message}
          </p>
        )}
        <p id="description-count" className="text-xs text-slate-500" aria-live="polite">
          {description.length} / 5,000 characters (at least 20 required)
        </p>
      </div>
      <Input
        label="Estimated claim amount"
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        {...register("amount")}
        error={errors.amount?.message}
      />
    </div>
  );
}
