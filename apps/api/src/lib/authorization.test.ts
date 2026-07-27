import { describe, expect, it } from "vitest";
import {
  assertPermissionSuperset,
  currentAuthorization,
  missingPermissions,
} from "./authorization.js";

describe("current authorization", () => {
  it("rejects missing and disabled administrator accounts", () => {
    expect(currentAuthorization("user-1", null)).toBeNull();
    expect(
      currentAuthorization("user-1", { status: "SUSPENDED", roles: [] }),
    ).toBeNull();
  });

  it("builds permissions and gang scopes from current database roles", () => {
    const authorization = currentAuthorization("user-1", {
      status: "ACTIVE",
      roles: [
        {
          gangId: "gang-1",
          role: {
            permissions: [
              { permission: { key: "gang.update.own" } },
              { permission: { key: "not-a-real-permission" } },
            ],
          },
        },
      ],
    });

    expect(authorization?.permissions).toEqual(new Set(["gang.update.own"]));
    expect(authorization?.gangScopes).toEqual(new Set(["gang-1"]));
  });
});

describe("permission subset checks", () => {
  it("returns only permissions the actor cannot grant", () => {
    expect(
      missingPermissions(
        ["role.manage", "user.manage"],
        ["role.manage", "audit.configure", "audit.configure"],
      ),
    ).toEqual(["audit.configure"]);
  });

  it("blocks attempts to grant a permission the actor does not hold", () => {
    expect(() => {
      assertPermissionSuperset(["role.manage"], ["role.manage", "user.manage"]);
    }).toThrow(/cannot grant or manage permissions/i);
  });
});
