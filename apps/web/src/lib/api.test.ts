import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "wst_csrf=; Max-Age=0; Path=/";
});

describe("API session reliability", () => {
  it("queues concurrent unauthorized requests behind one token refresh", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.endsWith("/api/v1/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(null, { status: 204 });
      }
      protectedCalls += 1;
      if (protectedCalls <= 2) {
        return Response.json(
          { error: { code: "AUTH_REQUIRED", message: "Expired" } },
          { status: 401 },
        );
      }
      return Response.json({ data: { ok: true } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      apiRequest<{ data: { ok: boolean } }>("/api/v1/admin/overview"),
      apiRequest<{ data: { ok: boolean } }>("/api/v1/admin/overview"),
    ]);

    expect(first.data.ok).toBe(true);
    expect(second.data.ok).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(4);
  });

  it("sends the CSRF cookie on mutations", async () => {
    document.cookie = "wst_csrf=csrf-value; Path=/";
    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-csrf-token")).toBe("csrf-value");
        return Promise.resolve(Response.json({ data: { saved: true } }));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ value: true }),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves the backend error code, request ID, and details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: "VERSION_CONFLICT",
                message: "The match changed.",
                requestId: "request-123",
                details: { currentVersion: 4 },
              },
            },
            { status: 409 },
          ),
        ),
      ),
    );

    const error = await apiRequest(
      "/api/v1/admin/matches/match-id",
      undefined,
      false,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      requestId: "request-123",
      details: { currentVersion: 4 },
    });
  });

  it("rejects a successful response that is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<!doctype html><title>Fallback</title>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        ),
      ),
    );

    const error = await apiRequest("/api/v1/gangs").catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 200,
      code: "INVALID_API_RESPONSE",
    });
  });
});
