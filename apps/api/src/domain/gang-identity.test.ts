import { describe, expect, it } from "vitest";
import { archivedGangIdentity } from "./gang-identity.js";

describe("archived gang identity", () => {
  it("releases the public slug and tag using the immutable gang id", () => {
    expect(archivedGangIdentity("cm123example")).toEqual({
      slug: "archived-cm123example",
      tag: "ARCHIVED-cm123example",
    });
  });

  it("produces a different identity for every archived gang", () => {
    expect(archivedGangIdentity("gang-one")).not.toEqual(
      archivedGangIdentity("gang-two"),
    );
  });
});
