import { z } from "zod";
import type { Policy } from "../../../types";

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function localDateToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createClaimSchema(policy?: Policy) {
  return z
    .object({
      policyId: z.string().min(1, "Choose a policy"),
      incidentDate: z
        .string()
        .min(1, "Choose the date of the incident")
        .refine(isValidDateInput, "Enter a valid incident date")
        .refine((value) => value <= localDateToday(), "Incident date cannot be in the future"),
      incidentType: z
        .string()
        .trim()
        .min(1, "Enter the incident type")
        .max(100, "Incident type must be 100 characters or fewer"),
      description: z
        .string()
        .trim()
        .min(20, "Description must be at least 20 characters")
        .max(5000, "Description must be 5,000 characters or fewer"),
      amount: z
        .string()
        .trim()
        .min(1, "Enter an estimated amount")
        .refine((value) => Number.isFinite(Number(value)), "Enter a valid amount")
        .refine((value) => Number(value) > 0, "Amount must be greater than zero")
        .refine(
          (value) => !policy || Number(value) <= Number(policy.coverageAmount),
          "Amount cannot exceed this policy's coverage",
        )
        .transform(Number),
    })
    .superRefine((values, context) => {
      if (!policy || values.policyId !== policy.id || !isValidDateInput(values.incidentDate)) {
        return;
      }

      const incidentDate = dateOnly(values.incidentDate);
      if (incidentDate < dateOnly(policy.startDate) || incidentDate > dateOnly(policy.endDate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["incidentDate"],
          message: "Incident date must fall within this policy's coverage dates",
        });
      }
    });
}

export type ClaimFormInput = z.input<ReturnType<typeof createClaimSchema>>;
export type ClaimFormValues = z.output<ReturnType<typeof createClaimSchema>>;
