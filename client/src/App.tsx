import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { GuestRoute, ProtectedRoute, RoleRoute } from "./auth/RouteGuards";
import { AppShell } from "./components/AppShell";
import { NotFoundPage, PlaceholderPage } from "./pages/PlaceholderPages";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import {
  ClaimDetailsPage,
  ClaimsPage,
  DashboardPage,
  PoliciesPage,
  PolicyDetailsPage,
} from "./pages/CustomerPages";
import { NewClaimPage } from "./pages/claims/new/NewClaimPage";

const queryClient = new QueryClient();

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
                  <Route path="admin" element={<PlaceholderPage pageKey="/admin" />} />
                  <Route path="admin/claims" element={<PlaceholderPage pageKey="/admin/claims" />} />
                  <Route path="admin/claims/:id" element={<PlaceholderPage pageKey="/admin/claims/:id" />} />
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
