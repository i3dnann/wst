import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import AdminCommandCenterPage from "./AdminCommandCenterPage";

vi.mock("@/lib/api", () => ({
  api: {
    adminMe: vi.fn(),
    adminGangs: vi.fn(),
    adminPlayers: vi.fn(),
    adminMatches: vi.fn(),
    adminTournaments: vi.fn(),
    publicSeasons: vi.fn(),
    disputeAssignees: vi.fn(),
    createGang: vi.fn(),
    createTournament: vi.fn(),
    updateTournament: vi.fn(),
    updateTournamentBanner: vi.fn(),
    adminLiveStreams: vi.fn(),
    createLiveStream: vi.fn(),
    updateLiveStream: vi.fn(),
    archiveLiveStream: vi.fn(),
    refreshLiveStream: vi.fn(),
    refreshAllLiveStreams: vi.fn(),
    adminLogout: vi.fn(),
  },
}));

const adminMe = vi.mocked(api.adminMe);
const adminGangs = vi.mocked(api.adminGangs);
const adminPlayers = vi.mocked(api.adminPlayers);
const adminMatches = vi.mocked(api.adminMatches);
const disputeAssignees = vi.mocked(api.disputeAssignees);
const createGang = vi.mocked(api.createGang);
const updateTournament = vi.mocked(api.updateTournament);
const updateTournamentBanner = vi.mocked(api.updateTournamentBanner);
const adminLiveStreams = vi.mocked(api.adminLiveStreams);
const createLiveStream = vi.mocked(api.createLiveStream);
const refreshLiveStream = vi.mocked(api.refreshLiveStream);
const adminLogout = vi.mocked(api.adminLogout);

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

function renderStreams() {
  adminMe.mockResolvedValue({
    data: {
      id: "admin-user-identifier-001",
      email: "admin@example.com",
      displayName: "Administrator",
      permissions: ["stream.manage"],
    },
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  adminLiveStreams.mockResolvedValue({
    data: [],
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  vi.mocked(api.adminTournaments).mockResolvedValue({
    data: [],
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/live-streams"]}>
        <AdminCommandCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderTournaments() {
  adminMe.mockResolvedValue({
    data: {
      id: "admin-user-identifier-001",
      email: "admin@example.com",
      displayName: "Administrator",
      permissions: [
        "tournament.read",
        "tournament.create",
        "tournament.update",
        "tournament.archive",
      ],
    },
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  vi.mocked(api.adminTournaments).mockResolvedValue({
    data: [
      {
        id: "tournament-identifier-0001",
        name: "World Star Cup",
        slug: "world-star-cup",
        description: "Sixteen gangs compete for the title.",
        bannerUrl: null,
        format: "SINGLE_ELIMINATION",
        status: "IN_PROGRESS",
        startAt: "2026-08-12T18:00:00.000Z",
        endAt: null,
        registrationOpenAt: null,
        registrationCloseAt: null,
        seasonId: null,
        maximumParticipants: 16,
        rules: "Check in before the match.\nRespect administrator decisions.",
        prizeDescription: null,
        featured: false,
        publicVisible: true,
        _count: { participants: 0, matches: 0 },
      },
    ],
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  vi.mocked(api.publicSeasons).mockResolvedValue({
    data: [],
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/tournaments"]}>
        <AdminCommandCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminCommandCenterPage record actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders the gang registry with the themed record-manager hierarchy", async () => {
    const { container } = renderGangs([
      "gang.read",
      "gang.create",
      "gang.update.any",
      "gang.archive",
    ]);

    expect(
      await screen.findByRole("heading", { name: "Gang records" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gang directory")).toBeInTheDocument();
    expect(screen.getByText("records shown")).toBeInTheDocument();
    expect(
      container.querySelector(".admin-records-manager--gang"),
    ).toBeInTheDocument();
  });

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
    expect(
      screen.getByRole("dialog", { name: "Add Gang" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Upload file" })).toHaveLength(
      2,
    );
    expect(
      screen.getByLabelText("Gang logo Cloudinary URL"),
    ).not.toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Gang name"), {
      target: { value: "Crimson Kings" },
    });
    expect(screen.getByText("Crimson Kings")).toHaveStyle({
      color: "#6C90C3",
    });
    fireEvent.change(screen.getByLabelText("Gang name color hex"), {
      target: { value: "#A83BFF" },
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
          primaryColor: "#A83BFF",
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

  it("manages up to 20 tournament rules and deletes them with a null update", async () => {
    updateTournament.mockResolvedValue({
      data: { id: "tournament-identifier-0001", rules: null },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderTournaments();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Tournament" }),
    );
    expect(screen.getByLabelText("Rule 1")).toHaveValue(
      "Check in before the match.",
    );
    expect(screen.getByLabelText("Rule 2")).toHaveValue(
      "Respect administrator decisions.",
    );

    for (let ruleNumber = 3; ruleNumber <= 20; ruleNumber += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add Rule" }));
      fireEvent.change(screen.getByLabelText(`Rule ${String(ruleNumber)}`), {
        target: { value: `Tournament rule ${String(ruleNumber)}` },
      });
    }

    expect(screen.getByText("20 / 20 added")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Rule" })).toBeDisabled();
    expect(screen.getAllByLabelText(/^Rule \d+$/)).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Delete all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save rules" }));

    await waitFor(() =>
      expect(updateTournament).toHaveBeenCalledWith(
        "tournament-identifier-0001",
        { rules: null },
      ),
    );
  });

  it("updates a tournament banner through the isolated banner endpoint", async () => {
    updateTournamentBanner.mockResolvedValue({
      data: {
        id: "tournament-identifier-0001",
        bannerUrl:
          "https://res.cloudinary.com/world-star/image/upload/v1/tournaments/cup.webp",
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderTournaments();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Tournament" }),
    );
    fireEvent.change(
      screen.getByLabelText("Tournament banner Cloudinary URL"),
      {
        target: {
          value:
            "https://res.cloudinary.com/world-star/image/upload/v1/tournaments/cup.webp",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateTournamentBanner).toHaveBeenCalledWith(
        "tournament-identifier-0001",
        "https://res.cloudinary.com/world-star/image/upload/v1/tournaments/cup.webp",
      ),
    );
    expect(updateTournament).not.toHaveBeenCalled();
  });

  it("creates a Kick stream from only the channel name", async () => {
    createLiveStream.mockResolvedValue({
      data: {
        id: "stream-identifier-000001",
        slug: "absi",
        streamerName: "Absi",
        platform: "KICK",
        channelUrl: "https://kick.com/absi",
        embedUrl: "https://player.kick.com/absi",
        thumbnailUrl: null,
        providerChannelId: "absi",
        liveVideoId: null,
        viewerCount: 0,
        streamTitle: null,
        categoryName: null,
        liveStartedAt: null,
        status: "OFFLINE",
        autoDetect: true,
        lastCheckedAt: null,
        lastStatusError: null,
        featured: false,
        startsAt: null,
        tournament: null,
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    refreshLiveStream.mockResolvedValue({
      data: {} as never,
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    renderStreams();

    fireEvent.click(await screen.findByRole("button", { name: "Add Stream" }));
    fireEvent.change(screen.getByLabelText("Kick streamer name"), {
      target: { value: "Absi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Kick Streamer" }));

    await waitFor(() =>
      expect(createLiveStream).toHaveBeenCalledWith({
        streamerName: "Absi",
        slug: "absi",
        platform: "KICK",
        channelUrl: "https://kick.com/absi",
        embedUrl: "https://player.kick.com/absi",
        providerChannelId: "absi",
        status: "OFFLINE",
        autoDetect: true,
        featured: false,
      }),
    );
    await waitFor(() =>
      expect(refreshLiveStream).toHaveBeenCalledWith(
        "stream-identifier-000001",
      ),
    );
  });

  it("clears the remembered administrator after a confirmed logout", async () => {
    adminMe.mockResolvedValue({
      data: {
        id: "admin-user-identifier-001",
        email: "admin@example.com",
        displayName: "Administrator",
        permissions: ["gang.read"],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    adminGangs.mockResolvedValue({
      data: [],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    adminLogout.mockResolvedValue(undefined);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/admin/gangs"]}>
          <Routes>
            <Route path="/admin/*" element={<AdminCommandCenterPage />} />
            <Route path="/admin/login" element={<p>Signed out</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(adminLogout).toHaveBeenCalledOnce();
    expect(client.getQueryData(["admin-me"])).toBeUndefined();
  });

  it("opens result management in a dismissible modal drawer", async () => {
    adminMe.mockResolvedValue({
      data: {
        id: "admin-user-identifier-001",
        email: "admin@example.com",
        displayName: "Administrator",
        permissions: ["match.finalize"],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    adminMatches.mockResolvedValue({
      data: [
        {
          id: "match-identifier-0000001",
          status: "SCHEDULED",
          version: 1,
          gangAScore: 0,
          gangBScore: 0,
          gangA: { id: "gang-identifier-00000001", name: "Crimson" },
          gangB: { id: "gang-identifier-00000002", name: "Vipers" },
          tournament: {
            id: "tournament-identifier-001",
            name: "World Star Cup",
          },
          bracketRound: {
            id: "round-identifier-00000001",
            name: "Round of 16",
          },
        },
      ],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    adminPlayers.mockResolvedValue({
      data: [],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    disputeAssignees.mockResolvedValue({
      data: [],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/admin/result"]}>
          <AdminCommandCenterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Manage" }));

    expect(
      screen.getByRole("dialog", { name: "Manage match result" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close result editor" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Manage match result" }),
    ).not.toBeInTheDocument();
  });
});
