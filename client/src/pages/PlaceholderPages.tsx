import { Link, useLocation, useParams } from "react-router-dom";
import { Button, Card, EmptyState } from "../components/ui";

interface PageContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
}

const contentByPath: Record<string, PageContent> = {
  "/dashboard": {
    eyebrow: "Your insurance, made simple",
    title: "Good things feel better when you're covered.",
    description: "Your coverage and claims, all in one clear place. We're here to make every next step a little easier.",
    primaryAction: { label: "View my policies", to: "/policies" },
    secondaryAction: { label: "Start a claim", to: "/claims/new" },
  },
  "/policies": {
    eyebrow: "Your protection",
    title: "My policies",
    description: "See your cover at a glance and find the details you need, whenever you need them.",
  },
  "/claims": {
    eyebrow: "We're here to help",
    title: "My claims",
    description: "Follow the progress of your claims and see updates from your claims team.",
    primaryAction: { label: "Start a new claim", to: "/claims/new" },
  },
  "/claims/new": {
    eyebrow: "Claims",
    title: "Start a claim",
    description: "Tell us a little about what happened. A member of our team will help guide you from here.",
  },
  "/admin": {
    eyebrow: "ClaimsSight team",
    title: "Admin overview",
    description: "A clear view of the claims that need your attention and the customers counting on you.",
    primaryAction: { label: "Review claims", to: "/admin/claims" },
  },
  "/admin/claims": {
    eyebrow: "ClaimsSight team",
    title: "Claim review",
    description: "Review incoming claims and keep each customer up to date along the way.",
  },
  "/login": {
    eyebrow: "Welcome back",
    title: "Sign in to your account",
    description: "Your coverage details and claim updates are right where you left them.",
    primaryAction: { label: "Create an account", to: "/register" },
  },
  "/register": {
    eyebrow: "A little more peace of mind",
    title: "Create your account",
    description: "Get a clearer view of your policies and claims, all in one secure place.",
    primaryAction: { label: "Already have an account? Sign in", to: "/login" },
  },
};

const quickHighlights = [
  { label: "Your policies", text: "Keep your coverage details close at hand.", to: "/policies", icon: "01" },
  { label: "Claim updates", text: "Know where things stand, without the guesswork.", to: "/claims", icon: "02" },
  { label: "A helping hand", text: "Start a claim whenever you need to.", to: "/claims/new", icon: "03" },
];

function PageHeading({ eyebrow, title, description }: Pick<PageContent, "eyebrow" | "title" | "description">) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function ActionLink({ to, children, variant = "primary" }: { to: string; children: string; variant?: "primary" | "outline" }) {
  return (
    <Link to={to}>
      <Button variant={variant === "outline" ? "outline" : "primary"}>{children}</Button>
    </Link>
  );
}

function DashboardContent() {
  return (
    <>
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#103e3b] via-[#14514a] to-[#1b6258] text-white shadow-lg shadow-teal-950/10">
        <div className="grid gap-8 p-1 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/80">Your ClaimSight dashboard</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A little more peace of mind, right here.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-teal-50/85 sm:text-base">
              Find your policy details, stay in the loop on claims, and get support when life takes an unexpected turn.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink to="/policies">Explore my policies</ActionLink>
              <ActionLink to="/claims/new" variant="outline">Start a claim</ActionLink>
            </div>
          </div>
          <div className="hidden size-28 items-center justify-center rounded-full border border-white/15 bg-white/10 sm:flex">
            <svg viewBox="0 0 80 80" className="size-16 text-teal-100" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M40 7 64 16v20c0 16-10 28-24 36C26 64 16 52 16 36V16l24-9Z" />
              <path d="m29 39 8 8 15-16" />
            </svg>
          </div>
        </div>
      </Card>

      <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-800">A good place to start</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Your insurance essentials</h2>
        </div>
        <p className="text-sm text-slate-500">Your personalized overview is coming soon.</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {quickHighlights.map((highlight) => (
          <Link key={highlight.label} to={highlight.to} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-teal-200 group-hover:shadow-md">
              <span className="text-xs font-bold tracking-wider text-teal-800">{highlight.icon}</span>
              <h3 className="mt-4 font-semibold text-slate-900">{highlight.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{highlight.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal-800">
                Take a look <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function DetailPage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const item = admin
    ? { eyebrow: "Claim review", title: "Claim details", description: "Review the information, supporting documents, and status history for this customer claim." }
    : { eyebrow: "Your claim", title: "Claim details", description: "See the latest information, status updates, and documents for your claim." };

  return (
    <div className="space-y-7">
      <PageHeading {...item} />
      <Card className="max-w-3xl">
        <EmptyState
          title="Claim details will appear here"
          description={id ? `Claim reference: ${id}. Claim information will be available here once connected to your account.` : "Your claim information will be available here once connected to your account."}
        />
      </Card>
    </div>
  );
}

export function PlaceholderPage({ pageKey }: { pageKey: string }) {
  const content = contentByPath[pageKey] ?? contentByPath["/dashboard"];
  const { id: policyId } = useParams();

  if (pageKey === "/dashboard") {
    return <DashboardContent />;
  }

  if (pageKey === "/policies/:id") {
    return (
      <div className="space-y-7">
        <PageHeading eyebrow="Your protection" title="Policy details" description="Your policy information, coverage, and key dates in one place." />
        <Card className="max-w-3xl">
          <EmptyState title="Policy details will appear here" description={`Policy reference: ${policyId ?? "—"}. Details will be available once connected to your account.`} />
        </Card>
      </div>
    );
  }

  if (pageKey === "/claims/:id") {
    return <DetailPage />;
  }

  if (pageKey === "/admin/claims/:id") {
    return <DetailPage admin />;
  }

  return (
    <div className="space-y-7">
      <PageHeading {...content} />
      {pageKey === "/login" || pageKey === "/register" ? (
        <Card className="max-w-xl">
          <EmptyState
            title="Sign-in forms are coming soon"
            description="Account access will be available here once authentication is connected."
            action={content.primaryAction && <ActionLink to={content.primaryAction.to} variant="outline">{content.primaryAction.label}</ActionLink>}
          />
        </Card>
      ) : (
        <Card className="max-w-4xl">
          <EmptyState
            title={pageKey.includes("claims") ? "No claims to show just yet" : "Your policy details are on their way"}
            description={pageKey.includes("claims")
              ? "Once claim information is connected, you'll be able to follow every update right here."
              : "Your policies will appear here when your account information is connected."}
            action={content.primaryAction && <ActionLink to={content.primaryAction.to}>{content.primaryAction.label}</ActionLink>}
          />
        </Card>
      )}
      {content.secondaryAction && (
        <div className="flex flex-wrap gap-3">
          <ActionLink to={content.secondaryAction.to} variant="outline">{content.secondaryAction.label}</ActionLink>
          <Link to="/login" className="inline-flex min-h-10 items-center px-3 text-sm font-semibold text-teal-800 hover:text-teal-950">Sign in</Link>
        </div>
      )}
    </div>
  );
}

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <span className="text-sm font-bold uppercase tracking-[0.18em] text-teal-800">404 · Page not found</span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Looks like this page took a detour.</h1>
      <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-600">
        We couldn't find <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{location.pathname}</code>. Let's get you back to the right place.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <ActionLink to={location.pathname.startsWith("/admin") ? "/admin" : "/dashboard"}>Back to overview</ActionLink>
        <Link to="/claims" className="inline-flex min-h-10 items-center px-3 text-sm font-semibold text-teal-800 hover:text-teal-950">View claims</Link>
      </div>
    </div>
  );
}
