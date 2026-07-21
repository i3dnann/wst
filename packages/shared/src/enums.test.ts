import { describe, expect, it } from "vitest";
import { matchStatuses } from "./index.js";

describe("shared enum contracts", () => {
  it("keeps match status options aligned with the backend contract", () => {
    expect(matchStatuses).toContain("CHECK_IN_OPEN");
    expect(matchStatuses).toContain("READY");
    expect(matchStatuses).not.toContain("CHECK_IN");
  });
});
