import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../../../api/client";
import { Button, Card, ErrorMessage, Spinner } from "../../../components/ui";
import { usePolicies } from "../../../hooks/useCustomerData";
import type { Claim } from "../../../types";
import { DocumentsStep } from "./DocumentsStep";
import { documentError } from "./document-validation";
import { IncidentStep } from "./IncidentStep";
import { PolicyStep } from "./PolicyStep";
import { ReviewStep } from "./ReviewStep";
import { createClaimSchema, type ClaimFormInput, type ClaimFormValues } from "./schema";

const stepTitles = ["Select a policy", "Incident details", "Upload documents", "Review and submit"];
const incidentFields = ["incidentDate", "incidentType", "description", "amount"] as const;

interface CreateClaimResponse {
  claim: Claim;
}

function safeClaimError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 400:
        return "Some claim details could not be accepted. Review the information and try again.";
      case 401:
        return "Your session has expired. Please sign in again and retry.";
      case 403:
        return "You are not allowed to file this claim.";
      case 404:
        return "The selected policy is no longer available. Choose an active policy and try again.";
      case 429:
        return "There have been too many requests. Please wait a moment and try again.";
      default:
        if (error.response && error.response.status >= 500) {
          return "The claim service is temporarily unavailable. Please try again.";
        }
    }
  }

  return "We couldn't submit your claim right now. Check your connection and try again.";
}

function todayAsInputDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function NewClaimPage() {
  const policiesQuery = usePolicies();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPolicyId = searchParams.get("policyId") ?? "";
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [documentErrors, setDocumentErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [schemaPolicyId, setSchemaPolicyId] = useState(initialPolicyId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimCreated, setClaimCreated] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const schema = useMemo(
    () => createClaimSchema(
      policiesQuery.data?.find((policy) => policy.id === schemaPolicyId && policy.status === "ACTIVE"),
    ),
    [policiesQuery.data, schemaPolicyId],
  );
  const {
    control,
    register,
    trigger,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ClaimFormInput, unknown, ClaimFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      policyId: "",
      incidentDate: "",
      incidentType: "",
      description: "",
      amount: "",
    },
    mode: "onTouched",
  });
  const policyId = useWatch({ control, name: "policyId" }) ?? "";
  const description = useWatch({ control, name: "description" }) ?? "";
  const policies = policiesQuery.data?.filter((policy) => policy.status === "ACTIVE") ?? [];
  const selectedPolicy = policies.find((policy) => policy.id === policyId);
  const mutation = useMutation({
    mutationFn: async (values: ClaimFormValues) => {
      const response = await apiClient.post<CreateClaimResponse>("/api/claims", {
        policyId: values.policyId,
        incidentDate: values.incidentDate,
        incidentType: values.incidentType,
        description: values.description,
        amount: values.amount,
      });
      return response.data.claim;
    },
  });
  const currentStepValid = !policiesQuery.isError && policiesQuery.isSuccess && policies.length > 0;

  useEffect(() => {
    if (!initialPolicyId || !policiesQuery.data) return;
    const candidate = policiesQuery.data.find(
      (policy) => policy.id === initialPolicyId && policy.status === "ACTIVE",
    );
    if (candidate && !getValues("policyId")) {
      setValue("policyId", candidate.id, { shouldDirty: false, shouldValidate: true });
    }
  }, [getValues, initialPolicyId, policiesQuery.data, setValue]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if ((claimCreated && files.length === 0) || (!isDirty && files.length === 0)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [claimCreated, files.length, isDirty]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const candidates = Array.from(incoming);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of candidates) {
      const message = documentError(file);
      if (message) rejected.push(message);
      else accepted.push(file);
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
    setDocumentErrors(rejected);
  }, []);

  async function goNext() {
    setSubmitError(null);
    if (step === 0 && !(await trigger("policyId"))) return;
    if (step === 1 && !(await trigger([...incidentFields]))) return;
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  }

  async function submitClaim(values: ClaimFormValues) {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    let claim: Claim;
    try {
      claim = await mutation.mutateAsync(values);
      setClaimCreated(true);
    } catch (error) {
      setIsSubmitting(false);
      setSubmitError(safeClaimError(error));
      return;
    }

    const failedFiles: string[] = [];
    for (const file of files) {
      try {
        const body = new FormData();
        body.append("file", file);
        await apiClient.post(`/api/claims/${encodeURIComponent(claim.id)}/documents`, body);
      } catch {
        failedFiles.push(file.name);
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["claims"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
    const toastMessage = failedFiles.length
      ? `Claim filed. These files could not be uploaded and can be added later: ${failedFiles.join(", ")}.`
      : "Your claim was filed successfully.";
    navigate(`/claims/${encodeURIComponent(claim.id)}`, {
      replace: true,
      state: { claimToast: toastMessage, claimToastTone: failedFiles.length ? "error" : "success" },
    });
  }

  if (policiesQuery.isPending) return <Spinner label="Loading your active policies" />;
  if (policiesQuery.isError) {
    return <ErrorMessage message="We couldn't load your policies. Please try again before filing a claim." />;
  }

  const activePolicies = policiesQuery.data.filter((policy) => policy.status === "ACTIVE");
  if (activePolicies.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="mb-4 text-2xl font-semibold text-slate-950">File a claim</h1>
          <PolicyStep policies={[]} policyId="" onSelect={() => undefined} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">We’re here to help</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">File a claim</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Share the incident details and any documents that may help us review your claim.
        </p>
      </header>
      <nav aria-label="Claim filing progress">
        <ol className="grid grid-cols-4 gap-2">
          {stepTitles.map((title, index) => (
            <li key={title}>
              {index < step ? (
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-left text-xs font-semibold text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 sm:px-3"
                  aria-label={`Go back to step ${index + 1}: ${title}`}
                >
                  <span className="block">Step {index + 1}</span>
                  <span className="hidden truncate sm:block">{title}</span>
                </button>
              ) : (
                <div
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold sm:px-3 ${
                    index === step
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                  aria-current={index === step ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${title}${index === step ? ", current step" : ""}`}
                >
                  <span className="block">Step {index + 1}</span>
                  <span className="hidden truncate sm:block">{title}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Step {step + 1} of {stepTitles.length}: {stepTitles[step]}
      </p>
      <Card>
        <form
          noValidate
          onSubmit={handleSubmit((values) => {
            if (step === stepTitles.length - 1) void submitClaim(values);
          })}
        >
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mb-5 text-xl font-semibold text-slate-950 focus:outline-none"
          >
            {stepTitles[step]}
          </h2>
          {submitError && <div className="mb-5"><ErrorMessage message={submitError} /></div>}
          {step === 0 && (
            <PolicyStep
              policies={activePolicies}
              policyId={policyId}
              error={errors.policyId?.message}
              onSelect={(value) => {
                setSchemaPolicyId(value);
                setValue("policyId", value, { shouldDirty: true, shouldValidate: true });
                void trigger("policyId");
              }}
            />
          )}
          {step === 1 && (
            <IncidentStep
              register={register}
              errors={errors}
              description={description}
              maxDate={todayAsInputDate()}
            />
          )}
          {step === 2 && (
            <DocumentsStep
              files={files}
              errors={documentErrors}
              onAddFiles={addFiles}
              onRemoveFile={(index) => setFiles((current) => current.filter((_file, currentIndex) => currentIndex !== index))}
            />
          )}
          {step === 3 && (
            <ReviewStep
              values={getValues()}
              policy={selectedPolicy}
              files={files}
              onEdit={setStep}
            />
          )}
          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || isSubmitting}>
              Back
            </Button>
            {step < stepTitles.length - 1 ? (
              <Button type="button" onClick={() => void goNext()} disabled={!currentStepValid}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner label="Submitting claim" /> : "Submit claim"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
