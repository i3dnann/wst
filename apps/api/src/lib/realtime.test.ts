import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drawConfirmationIssue, realtimeHub } from "./realtime.js";

const participants = ["Alpha", "Bravo", "Charlie", "Delta"].map(
  (name, index) => ({
    id: `participant-${String(index + 1)}`,
    gang: {
      id: `gang-${String(index + 1)}`,
      name,
      tag: name.slice(0, 3).toUpperCase(),
      logoUrl: null,
    },
  }),
);

describe("realtime tournament draws", () => {
  beforeEach(() => {
    realtimeHub.resetForTests();
  });
  afterEach(() => {
    realtimeHub.resetForTests();
  });

  it("broadcasts a unique authoritative selection for every spin", async () => {
    realtimeHub.startDraw({
      tournamentId: "tournament-1",
      tournamentSlug: "world-star-cup",
      tournamentName: "World Star Cup",
      participants,
    });
    const started = await realtimeHub.poll(0);
    expect(started.events.map(({ type }) => type)).toEqual(["draw.started"]);
    expect(started.activeDraws).toHaveLength(1);

    const selected = Array.from({ length: participants.length }, () =>
      realtimeHub.spinDraw("tournament-1"),
    ).map((result) => result?.selectedParticipantId);
    expect(new Set(selected).size).toBe(participants.length);

    const afterSpins = await realtimeHub.poll(started.cursor);
    expect(afterSpins.events).toHaveLength(participants.length);
    expect(afterSpins.events.every(({ type }) => type === "draw.spin")).toBe(
      true,
    );
    expect(afterSpins.activeDraws[0]?.drawnParticipantIds).toHaveLength(
      participants.length,
    );
  });

  it("ends the live draw and broadcasts the persisted bracket version", async () => {
    realtimeHub.startDraw({
      tournamentId: "tournament-1",
      tournamentSlug: "world-star-cup",
      tournamentName: "World Star Cup",
      participants,
    });
    const cursor = (await realtimeHub.poll(0)).cursor;
    realtimeHub.completeDraw("tournament-1", "world-star-cup", 7);

    const completed = await realtimeHub.poll(cursor);
    expect(completed.activeDraws).toHaveLength(0);
    expect(completed.events.map(({ type }) => type)).toEqual([
      "draw.completed",
      "bracket.updated",
    ]);
    expect(completed.events.at(-1)?.data).toMatchObject({
      tournamentSlug: "world-star-cup",
      bracketVersion: 7,
    });
  });

  it("allows bracket confirmation only for the completed authoritative order", () => {
    const started = realtimeHub.startDraw({
      tournamentId: "tournament-1",
      tournamentSlug: "world-star-cup",
      tournamentName: "World Star Cup",
      participants,
    });
    expect(
      drawConfirmationIssue(started, "DRAW", started.drawnParticipantIds),
    ).toBe("DRAW_INCOMPLETE");

    for (let index = 0; index < participants.length; index += 1)
      realtimeHub.spinDraw("tournament-1");
    const completed = realtimeHub.getDraw("tournament-1");
    expect(completed).not.toBeNull();
    expect(
      drawConfirmationIssue(
        completed,
        "DRAW",
        completed?.drawnParticipantIds,
      ),
    ).toBeNull();
    expect(
      drawConfirmationIssue(completed, "DRAW", [
        ...(completed?.drawnParticipantIds ?? []),
      ].reverse()),
    ).toBe("DRAW_ORDER_MISMATCH");
    expect(
      drawConfirmationIssue(
        completed,
        "SEEDED",
        completed?.drawnParticipantIds,
      ),
    ).toBe("DRAW_NOT_ACTIVE");
  });
});
