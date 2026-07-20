import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("administrator password hashing", () => {
  it("uses a unique salt and verifies only the correct password", async () => {
    const password = "a-long-administrator-password";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", first)).resolves.toBe(
      false,
    );
  });
});
