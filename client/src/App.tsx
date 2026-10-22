import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { GuestRoute, ProtectedRoute, RoleRoute } from "./auth/RouteGuards";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { NotFoundPage } from "./pages/PlaceholderPages";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import {
  ClaimDetailsPage,
  ClaimsPage,
  DashboardPage,
  PoliciesPage,
  PolicyDetailsPage,
} from "./pages/CustomerPages";
import { NewClaimPage } from "./pages/claims/new/NewClaimPage";

const AdminDashboardPage = lazy(() =>
  import("./pages/AdminPages").then(({ AdminDashboardPage: page }) => ({ default: page })),
);
const AdminClaimsPage = lazy(() =>
  import("./pages/AdminPages").then(({ AdminClaimsPage: page }) => ({ default: page })),
);
const ClaimReviewPage = lazy(() =>
  import("./pages/AdminPages").then(({ ClaimReviewPage: page }) => ({ default: page })),
);

const queryClient = new QueryClient();

function RouteLoading({ title, label }: { title: string; label: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <Spinner label={label} />
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="login"
                element={
                  <GuestRoute>
                    <LoginPage />
                  </GuestRoute>
                }
              />
              <Route
                path="register"
                element={
                  <GuestRoute>
                    <RegisterPage />
                  </GuestRoute>
                }
              />
              <Route element={<ProtectedRoute />}>
                <Route index element={<HomeRedirect />} />
                <Route element={<RoleRoute role="CUSTOMER" />}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="policies/:id" element={<PolicyDetailsPage />} />
                  <Route path="claims" element={<ClaimsPage />} />
                  <Route path="claims/new" element={<NewClaimPage />} />
                  <Route path="claims/:id" element={<ClaimDetailsPage />} />
                </Route>
                <Route element={<RoleRoute role="ADMIN" />}>
                  <Route path="admin" element={<Suspense fallback={<RouteLoading title="Claims dashboard" label="Loading admin dashboard" />}><AdminDashboardPage /></Suspense>} />
                  <Route path="admin/claims" element={<Suspense fallback={<RouteLoading title="All claims" label="Loading claims" />}><AdminClaimsPage /></Suspense>} />
                  <Route path="admin/claims/:id" element={<Suspense fallback={<RouteLoading title="Claim review" label="Loading claim review" />}><ClaimReviewPage /></Suspense>} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
