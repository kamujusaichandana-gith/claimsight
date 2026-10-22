import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui";

export function NotFoundPage() {
  const location = useLocation();
  const overviewPath = location.pathname.startsWith("/admin") ? "/admin" : "/dashboard";

  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <span className="text-sm font-bold uppercase tracking-[0.18em] text-teal-800">404 · Page not found</span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        Looks like this page took a detour.
      </h1>
      <p className="mx-auto mt-4 max-w-lg break-words text-base leading-7 text-slate-600">
        We couldn't find <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{location.pathname}</code>. Let's get you back to the right place.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to={overviewPath}>
          <Button>Back to overview</Button>
        </Link>
        <Link to="/claims" className="inline-flex min-h-10 items-center px-3 text-sm font-semibold text-teal-800 hover:text-teal-950">
          View claims
        </Link>
      </div>
    </div>
  );
}
