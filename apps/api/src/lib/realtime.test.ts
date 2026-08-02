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

  it("automatically pairs the final two gangs after the last required spin", async () => {
    realtimeHub.startDraw({
      tournamentId: "tournament-1",
      tournamentSlug: "world-star-cup",
      tournamentName: "World Star Cup",
      participants,
    });
    const started = await realtimeHub.poll(0);
    expect(started.events.map(({ type }) => type)).toEqual(["draw.started"]);
    expect(started.activeDraws).toHaveLength(1);

    const selected = Array.from({ length: 2 }, () =>
      realtimeHub.spinDraw("tournament-1"),
    ).map((result) => result?.selectedParticipantId);
    expect(new Set(selected).size).toBe(2);

    const afterSpins = await realtimeHub.poll(started.cursor);
    expect(afterSpins.events).toHaveLength(2);
    expect(afterSpins.events.every(({ type }) => type === "draw.spin")).toBe(
      true,
    );
    expect(afterSpins.activeDraws[0]?.drawnParticipantIds).toHaveLength(
      participants.length,
    );
    expect(realtimeHub.spinDraw("tournament-1")).toBeNull();
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

  it("wakes connected clients when administrator data changes", async () => {
    realtimeHub.publish("data.changed", {
      action: "tournament.archive",
      entityType: "Tournament",
      entityId: "tournament-1",
    });

    const snapshot = await realtimeHub.poll(0);

    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({
      type: "data.changed",
      data: {
        action: "tournament.archive",
        entityType: "Tournament",
        entityId: "tournament-1",
      },
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

    for (let index = 0; index < participants.length - 2; index += 1)
      realtimeHub.spinDraw("tournament-1");
    const completed = realtimeHub.getDraw("tournament-1");
    expect(completed).not.toBeNull();
    expect(
      drawConfirmationIssue(completed, "DRAW", completed?.drawnParticipantIds),
    ).toBeNull();
    expect(
      drawConfirmationIssue(
        completed,
        "DRAW",
        [...(completed?.drawnParticipantIds ?? [])].reverse(),
      ),
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
