interface NetlifyEvent {
  httpMethod: string;
  path?: string;
  rawUrl?: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded: boolean;
  queryStringParameters: Record<string, string | undefined> | null;
}

interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded?: boolean;
}

const ignoredRequestHeaders = new Set(["host", "content-length", "connection"]);
const ignoredResponseHeaders = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
]);

function inferRequestedPath(event: NetlifyEvent) {
  const queryPath = event.queryStringParameters?.path;
  if (queryPath) return queryPath;

  const candidatePaths = [event.rawUrl, event.path].flatMap((value) => {
    if (!value) return [];
    try {
      return [new URL(value).pathname, value];
    } catch {
      return [value];
    }
  });

  for (const path of candidatePaths) {
    for (const prefix of ["/backend/", "/.netlify/functions/backend/"]) {
      const index = path.indexOf(prefix);
      if (index >= 0) return path.slice(index + prefix.length);
    }
  }

  return "";
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const configuredTarget = process.env.API_PROXY_TARGET?.trim().replace(
    /\/$/,
    "",
  );
  if (!configuredTarget) {
    return {
      statusCode: 503,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: {
          code: "API_PROXY_NOT_CONFIGURED",
          message: "The API proxy target is not configured.",
        },
      }),
    };
  }
  const target = new URL(configuredTarget);
  const allowInsecureProxy =
    process.env.API_PROXY_ALLOW_INSECURE?.trim().toLowerCase() === "true";
  if (
    target.protocol !== "https:" &&
    target.hostname !== "127.0.0.1" &&
    target.hostname !== "localhost" &&
    !allowInsecureProxy
  ) {
    return {
      statusCode: 503,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: {
          code: "API_PROXY_INSECURE",
          message: "The production API proxy requires HTTPS.",
        },
      }),
    };
  }
  const requestedPath = inferRequestedPath(event);
  const destination = new URL(
    requestedPath.replace(/^\/+/, ""),
    `${target.toString().replace(/\/$/, "")}/`,
  );
  for (const [name, value] of Object.entries(
    event.queryStringParameters ?? {},
  )) {
    if (name !== "path" && value !== undefined)
      destination.searchParams.append(name, value);
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) {
    if (value && !ignoredRequestHeaders.has(name.toLowerCase()))
      headers.set(name, value);
  }
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body
    : undefined;
  try {
    const response = await fetch(destination, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : body,
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (!ignoredResponseHeaders.has(name.toLowerCase()))
        responseHeaders[name] = value;
    });
    const cookieHeaders = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const cookies = cookieHeaders.getSetCookie?.() ?? [];
    const responseBody = Buffer.from(await response.arrayBuffer());
    return {
      statusCode: response.status,
      headers: responseHeaders,
      ...(cookies.length
        ? { multiValueHeaders: { "set-cookie": cookies } }
        : {}),
      body: responseBody.toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return {
      statusCode: 502,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: {
          code: "API_PROXY_UNAVAILABLE",
          message: "The World Star API is unavailable.",
        },
      }),
    };
  }
}
