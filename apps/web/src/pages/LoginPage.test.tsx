import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import LoginPage from "./LoginPage";

vi.mock("@/lib/api", () => ({
  api: {
    adminMe: vi.fn(),
    adminLogin: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const adminMe = vi.mocked(api.adminMe);

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderLogin(
  initialEntry: string | { pathname: string; state: unknown },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage session restoration", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows the login form when no remembered session exists", async () => {
    adminMe.mockRejectedValue(new Error("Unauthorized"));
    renderLogin("/admin/login");

    expect(
      await screen.findByRole("button", { name: "Enter Command Center" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/stays active for 30 days/i)).toBeInTheDocument();
  });

  it("redirects an authenticated administrator without showing the form", async () => {
    adminMe.mockResolvedValue({
      data: {
        id: "admin-user-identifier-001",
        email: "admin@example.com",
        displayName: "Administrator",
        permissions: ["gang.read"],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderLogin("/admin/login");

    expect(screen.getByText("Restoring secure session")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/admin/overview",
      ),
    );
  });

  it("returns to the requested admin section after restoring the session", async () => {
    adminMe.mockResolvedValue({
      data: {
        id: "admin-user-identifier-001",
        email: "admin@example.com",
        displayName: "Administrator",
        permissions: ["gang.read"],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderLogin({
      pathname: "/admin/login",
      state: { from: "/admin/gangs" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/gangs"),
    );
  });
});
