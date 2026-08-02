import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import GangDetailPage from "./GangDetailPage";

vi.mock("@/lib/api", () => ({
  api: {
    gang: vi.fn(),
  },
}));

const gang = vi.mocked(api.gang);

describe("GangDetailPage banner", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders a complete-color foreground banner over a decorative backdrop", async () => {
    gang.mockResolvedValue({
      data: {
        id: "gang-identifier-00000001",
        slug: "crimson-syndicate",
        name: "Crimson Syndicate",
        tag: "CS",
        motto: "Loyalty above all",
        bannerUrl: "https://cdn.example.com/crimson-banner.png",
        logoUrl: "https://cdn.example.com/crimson-logo.png",
        primaryColor: "#A83BFF",
        verified: true,
        memberships: [],
        seasonStats: [],
        awards: [],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/gangs/crimson-syndicate"]}>
          <Routes>
            <Route path="/gangs/:slug" element={<GangDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const banner = await screen.findByRole("img", {
      name: "Crimson Syndicate banner",
    });
    expect(banner).toHaveClass(
      "gang-profile-v3__banner",
      "user-media-original",
    );
    expect(
      document.querySelector<HTMLImageElement>(
        ".gang-profile-v3__banner-backdrop",
      ),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("heading", { name: "Crimson Syndicate" }),
    ).toHaveStyle({ color: "#A83BFF" });
  });
});
