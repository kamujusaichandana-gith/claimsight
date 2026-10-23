import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { Button, Card, Input, Spinner, Toast } from "../components/ui";
import type { User } from "../types";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254, "Email is too long"),
  password: z.string().min(1, "Enter your password").max(72, "Password is too long"),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name must be 100 characters or fewer"),
  email: z.string().trim().email("Enter a valid email address").max(254, "Email is too long"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Password must be 72 characters or fewer"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function safeApiError(error: unknown, action: "login" | "register") {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response;
    if (typeof response === "object" && response !== null && "status" in response) {
      if (response.status === 401 && action === "login") {
        return "Invalid email or password";
      }
      if (response.status === 409 && action === "register") {
        return "An account with this email already exists.";
      }
      if (response.status === 400) {
        return "Please check the information you entered and try again.";
      }
      if (response.status === 429) {
        return "Too many attempts. Please wait a little while and try again.";
      }
    }
  }

  return action === "login"
    ? "Unable to sign in right now. Please try again."
    : "Unable to create your account right now. Please try again.";
}

function getReturnPath(state: unknown, user: User) {
  const fallback = user.role === "ADMIN" ? "/admin" : "/dashboard";
  if (typeof state !== "object" || state === null || !("from" in state)) return fallback;

  const from = state.from;
  if (
    typeof from !== "object" ||
    from === null ||
    !("pathname" in from) ||
    typeof from.pathname !== "string" ||
    !from.pathname.startsWith("/") ||
    from.pathname.startsWith("//")
  ) {
    return fallback;
  }

  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  const hash = "hash" in from && typeof from.hash === "string" ? from.hash : "";
  return `${from.pathname}${search}${hash}`;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSlow, setApiSlow] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    setApiSlow(false);
    const slowResponseTimer = window.setTimeout(() => setApiSlow(true), 5000);
    try {
      const user = await login(values);
      navigate(getReturnPath(location.state, user), { replace: true });
    } catch (error) {
      setApiError(safeApiError(error, "login"));
    } finally {
      window.clearTimeout(slowResponseTimer);
    }
  });

  function submitDemoLogin(email: string, password: string) {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
    void onSubmit();
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 py-4 lg:grid-cols-[1fr_0.85fr] lg:items-center">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Sign in to ClaimSight</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Your coverage details and claim updates are right where you left them.</p>
      </div>
      <Card className="w-full max-w-lg">
        <form className="grid gap-5" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sign in to your account</h2>
            <p className="mt-1 text-sm text-slate-500">Enter the email and password associated with your account.</p>
          </div>
          {apiError && (
            <Toast message={apiError} tone="error" onClose={() => setApiError(null)} />
          )}
          {apiSlow && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="status">
              The demo server may be waking up, this can take up to a minute.
            </p>
          )}
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
            error={errors.password?.message}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Spinner label="Signing in" /> : "Sign in"}
          </Button>
          <section className="grid gap-3 border-t border-slate-100 pt-5" aria-labelledby="demo-access-heading">
            <div>
              <h3 id="demo-access-heading" className="text-sm font-semibold text-slate-900">Demo access</h3>
              <p className="mt-1 text-sm text-slate-500">This is a demo with fictional data.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => submitDemoLogin("avery.brooks@example.test", "CustomerDemo123!")}
              >
                Try as customer
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => submitDemoLogin("admin@claimsight.local", "AdminDemo123!")}
              >
                Try as admin
              </Button>
            </div>
          </section>
          <p className="text-center text-sm text-slate-600">
            New to ClaimSight?{" "}
            <Link to="/register" className="font-semibold text-teal-800 hover:text-teal-950">Create an account</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const user = await registerAccount(values);
      navigate(getReturnPath(location.state, user), { replace: true });
    } catch (error) {
      setApiError(safeApiError(error, "register"));
    }
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 py-4 lg:grid-cols-[1fr_0.85fr] lg:items-center">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">A little more peace of mind</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Create your ClaimSight account</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Get a clearer view of your policies and claims, all in one secure place.</p>
      </div>
      <Card className="w-full max-w-lg">
        <form className="grid gap-5" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
            <p className="mt-1 text-sm text-slate-500">Your account will be set up with customer access.</p>
          </div>
          {apiError && (
            <Toast message={apiError} tone="error" onClose={() => setApiError(null)} />
          )}
          <Input
            label="Full name"
            type="text"
            autoComplete="name"
            {...register("name")}
            error={errors.name?.message}
          />
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="Use at least 8 characters."
            {...register("password")}
            error={errors.password?.message}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Spinner label="Creating account" /> : "Create account"}
          </Button>
          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-950">Sign in</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
