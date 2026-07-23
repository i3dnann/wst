import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { realtimeHub } from "./realtime.js";

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
});
