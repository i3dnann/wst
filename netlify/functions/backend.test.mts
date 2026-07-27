import assert from "node:assert/strict";
import test from "node:test";
import { buildProxyDestination } from "./backend.mts";

test("keeps normal proxy paths on the configured API origin", () => {
  const destination = buildProxyDestination(
    new URL("https://api.wstgang.com/base"),
    "/api/v1/public/home",
    { page: "2" },
  );

  assert.equal(destination.origin, "https://api.wstgang.com");
  assert.equal(destination.pathname, "/base/api/v1/public/home");
  assert.equal(destination.search, "?page=2");
});

for (const craftedPath of [
  "https://attacker.example/collect",
  "//attacker.example/collect",
  "http:\\\\attacker.example\\collect",
]) {
  test(`does not allow ${craftedPath} to change the upstream origin`, () => {
    const destination = buildProxyDestination(
      new URL("https://api.wstgang.com"),
      craftedPath,
      null,
    );

    assert.equal(destination.origin, "https://api.wstgang.com");
    assert.notEqual(destination.hostname, "attacker.example");
  });
}
