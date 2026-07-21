import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import AdminCommandCenterPage from "./AdminCommandCenterPage";

vi.mock("@/lib/api", () => ({
  api: {
    adminMe: vi.fn(),
    adminGangs: vi.fn(),
    adminTournaments: vi.fn(),
    publicSeasons: vi.fn(),
    createGang: vi.fn(),
    adminLogout: vi.fn(),
  },
}));

const adminMe = vi.mocked(api.adminMe);
const adminGangs = vi.mocked(api.adminGangs);
const createGang = vi.mocked(api.createGang);

function renderGangs(permissions: string[]) {
  adminMe.mockResolvedValue({
    data: {
      id: "admin-user-identifier-001",
      email: "admin@example.com",
      displayName: "Administrator",
      permissions,
    },
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  adminGangs.mockResolvedValue({
    data: [],
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/gangs"]}>
        <AdminCommandCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminCommandCenterPage record actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("opens and submits the gang creator with an automatic slug", async () => {
    createGang.mockResolvedValue({
      data: { id: "gang-identifier-00000001" },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderGangs([
      "gang.read",
      "gang.create",
      "gang.update.any",
      "gang.archive",
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Add Gang" }));
    fireEvent.change(screen.getByLabelText("Gang name"), {
      target: { value: "Crimson Kings" },
    });
    fireEvent.change(screen.getByLabelText("Tag"), {
      target: { value: "CK" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(createGang).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Crimson Kings",
          slug: "crimson-kings",
          tag: "CK",
          status: "ACTIVE",
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save Changes" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows read-only access instead of dead mutation controls", async () => {
    renderGangs(["gang.read"]);

    expect(await screen.findByText("Read-only access")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Gang" }),
    ).not.toBeInTheDocument();
  });
});
