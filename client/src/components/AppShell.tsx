import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const customerLinks = [
  { to: "/dashboard", label: "Overview" },
  { to: "/policies", label: "My policies" },
  { to: "/claims", label: "Claims" },
];

const adminLinks = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/claims", label: "Claim review" },
];

function BrandMark() {
  return (
    <span className="grid size-9 place-items-center rounded-xl bg-teal-800 text-white shadow-sm">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 2.8 19 5.5v5.8c0 4.6-2.9 8-7 9.9-4.1-1.9-7-5.3-7-9.9V5.5l7-2.7Z" />
        <path d="m8.8 11.8 2.1 2.1 4.4-4.5" />
      </svg>
    </span>
  );
}

export function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const links = isAdmin ? adminLinks : customerLinks;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8f7] text-slate-900">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-teal-900 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="ClaimSight home">
            <BrandMark />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Claim<span className="text-teal-800">Sight</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${isActive ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="text-xs font-medium text-slate-500">
              {isAdmin ? "Admin workspace" : "Customer portal"}
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-[#e6f1ee] text-sm font-semibold text-teal-900" aria-label="Guest profile">
              G
            </span>
          </div>

          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3.5 py-3 text-sm font-medium ${isActive ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50"}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="border-t border-slate-100 px-3.5 pt-3 text-xs font-medium text-slate-500">
                {isAdmin ? "Admin workspace" : "Customer portal"} · Preview
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© ClaimSight Insurance Services</p>
          <p>Here to help you feel covered, every step of the way.</p>
        </div>
      </footer>
    </div>
  );
}
