import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { forwardRef } from "react";
import type { ClaimStatus } from "../types";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-teal-800 text-white shadow-sm hover:bg-teal-900",
    secondary: "bg-teal-50 text-teal-900 hover:bg-teal-100",
    outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const helpId = inputId ? `${inputId}-help` : undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? helpId : undefined}
        className={`min-h-11 rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-slate-50 ${error ? "border-rose-400" : "border-slate-200"} ${className}`}
        {...props}
      />
      {(error || hint) && (
        <span id={helpId} className={`text-xs ${error ? "text-rose-700" : "text-slate-500"}`}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
});

Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, id, className = "", ...props },
  ref,
) {
  const selectId = id ?? props.name;
  const helpId = selectId ? `${selectId}-error` : undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={selectId}>
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? helpId : undefined}
        className={`min-h-11 rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${error ? "border-rose-400" : "border-slate-200"} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={helpId} className="text-xs text-rose-700">
          {error}
        </span>
      )}
    </div>
  );
});

Select.displayName = "Select";

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className = "", padded = true }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.035)] ${padded ? "p-5 sm:p-6" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

const claimStatusStyles: Record<ClaimStatus, string> = {
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-800",
  UNDER_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  PAID: "border-violet-200 bg-violet-50 text-violet-800",
};

export function Badge({ status }: { status: ClaimStatus }) {
  const label = status.replaceAll("_", " ").toLowerCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${claimStatusStyles[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
      <span
        className="size-4 animate-spin rounded-full border-2 border-teal-800/20 border-t-teal-800"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-800" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" />
          <path d="M14 4v5h4M8.5 13h7M8.5 16.5h5" />
        </svg>
      </span>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
      <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6v4.5m0 3h.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

interface ToastProps {
  message: string;
  onClose: () => void;
  tone?: "success" | "error";
}

export function Toast({ message, onClose, tone = "success" }: ToastProps) {
  const isError = tone === "error";

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${isError ? "border-rose-200 bg-white text-rose-900" : "border-emerald-200 bg-white text-emerald-900"}`}
      role={isError ? "alert" : "status"}
    >
      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${isError ? "bg-rose-50" : "bg-emerald-50"}`} aria-hidden="true">
        {isError ? "!" : "✓"}
      </span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
      >
        ×
      </button>
    </div>
  );
}
