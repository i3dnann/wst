import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import EventsPage from "./EventsPage";

vi.mock("@/lib/api", () => ({
  api: {
    events: vi.fn(),
  },
}));

const events = vi.mocked(api.events);

describe("EventsPage details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.mockResolvedValue({
      data: [
        {
          id: "event-identifier-00000001",
          slug: "world-star-night",
          title: "World Star Night",
          description:
            "An official community gathering with live tournament coverage.",
          rules:
            "Arrive before check-in.\nRespect the event staff and published match decisions.",
          imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
          location: "World Star Arena",
          startsAt: "2026-08-10T18:00:00.000Z",
          endsAt: "2026-08-10T22:00:00.000Z",
          status: "SCHEDULED",
          featured: true,
        },
      ],
      meta: {
        requestId: "test",
        timestamp: new Date().toISOString(),
      },
    });
  });
  afterEach(cleanup);

  it("opens a readable event modal and closes it with Escape", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EventsPage />
      </QueryClientProvider>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Read more about World Star Night",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "World Star Night" });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/official community gathering/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/arrive before check-in/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "World Star Night event artwork" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "World Star Night" }),
    ).not.toBeInTheDocument();
  });
});
