import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { NotFoundPage, PlaceholderPage } from "./pages/PlaceholderPages";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="login" element={<PlaceholderPage pageKey="/login" />} />
            <Route path="register" element={<PlaceholderPage pageKey="/register" />} />
            <Route path="dashboard" element={<PlaceholderPage pageKey="/dashboard" />} />
            <Route path="policies" element={<PlaceholderPage pageKey="/policies" />} />
            <Route path="policies/:id" element={<PlaceholderPage pageKey="/policies/:id" />} />
            <Route path="claims" element={<PlaceholderPage pageKey="/claims" />} />
            <Route path="claims/new" element={<PlaceholderPage pageKey="/claims/new" />} />
            <Route path="claims/:id" element={<PlaceholderPage pageKey="/claims/:id" />} />
            <Route path="admin" element={<PlaceholderPage pageKey="/admin" />} />
            <Route path="admin/claims" element={<PlaceholderPage pageKey="/admin/claims" />} />
            <Route path="admin/claims/:id" element={<PlaceholderPage pageKey="/admin/claims/:id" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
