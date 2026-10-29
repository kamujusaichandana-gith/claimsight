import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage, RegisterPage } from "../pages/AuthPages";
import { ProtectedRoute, RoleRoute } from "./RouteGuards";
import { admin, createFakeAuth, customer, renderWithProviders } from "../test/test-utils";
import { LocationProbe } from "../test/LocationProbe";

function GuardRoutes() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<p>Login destination</p>} />
        <Route path="/dashboard" element={<p>Customer destination</p>} />
        <Route path="/admin" element={<p>Admin destination</p>} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/customer"
            element={<RoleRoute role="CUSTOMER"><p>Customer content</p></RoleRoute>}
          />
          <Route
            path="/administrator"
            element={<RoleRoute role="ADMIN"><p>Admin content</p></RoleRoute>}
          />
        </Route>
      </Routes>
      <LocationProbe />
    </>
  );
}

describe("route guards", () => {
  it("redirects an unauthenticated user to /login", async () => {
    renderWithProviders(<GuardRoutes />, { initialEntries: ["/customer"] });
    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
    expect(screen.queryByText("Customer content")).not.toBeInTheDocument();
  });

  it("redirects a customer away from an admin route", async () => {
    renderWithProviders(<GuardRoutes />, {
      auth: createFakeAuth({ user: customer }),
      initialEntries: ["/administrator"],
    });
    expect(await screen.findByText("Customer destination")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it("redirects an admin away from a customer-only route", async () => {
    renderWithProviders(<GuardRoutes />, {
      auth: createFakeAuth({ user: admin }),
      initialEntries: ["/customer"],
    });
    expect(await screen.findByText("Admin destination")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/admin");
  });

  it("shows a spinner without protected content while auth is loading", () => {
    renderWithProviders(<GuardRoutes />, {
      auth: createFakeAuth({ isLoading: true }),
      initialEntries: ["/customer"],
    });
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Checking your account");
    expect(screen.queryByText("Customer content")).not.toBeInTheDocument();
  });
});

describe("login and registration", () => {
  it("shows login validation messages without submitting", async () => {
    const login = vi.fn(async () => customer);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      auth: createFakeAuth({ login }),
      initialEntries: ["/login"],
    });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows registration validation messages without submitting", async () => {
    const register = vi.fn(async () => customer);
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, {
      auth: createFakeAuth({ register }),
      initialEntries: ["/register"],
    });

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers without sending a role field", async () => {
    const register = vi.fn(async () => customer);
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, {
      auth: createFakeAuth({ register }),
      initialEntries: ["/register"],
    });

    await user.type(screen.getByLabelText("Full name"), "Avery Brooks");
    await user.type(screen.getByLabelText("Email address"), "avery@example.test");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      name: "Avery Brooks",
      email: "avery@example.test",
      password: "password123",
    });
  });

  it("fills and submits both demo credential sets", async () => {
    const login = vi.fn(async () => customer);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      auth: createFakeAuth({ login }),
      initialEntries: ["/login"],
    });

    await user.click(screen.getByRole("button", { name: "Try as customer" }));
    await waitFor(() => expect(login).toHaveBeenNthCalledWith(1, {
      email: "avery.brooks@example.test",
      password: "CustomerDemo123!",
    }));
    expect(screen.getByLabelText("Email address")).toHaveValue("avery.brooks@example.test");

    await user.click(screen.getByRole("button", { name: "Try as admin" }));
    await waitFor(() => expect(login).toHaveBeenNthCalledWith(2, {
      email: "admin@claimsight.local",
      password: "AdminDemo123!",
    }));
  });
});
