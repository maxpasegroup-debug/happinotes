import { test } from "node:test";
import assert from "node:assert/strict";
import { proxyGoogleBrowser } from "../lib/google-auth-proxy.ts";

const id = "a".repeat(64),
  secret = "b".repeat(64);
const cookie = `__Host-happiGoogle-${id.slice(0, 12)}`;
const page = () =>
  new Request(
    `https://happinotes.online/auth/google/browser/page?session=${id}`,
    {
      headers: {
        cookie: `adminToken=private; ${cookie}=${secret}; other=private`,
        authorization: "Bearer private",
      },
    },
  );
const complete = (headers = {}, body = { sessionId: id, cancelled: true }) =>
  new Request("https://happinotes.online/auth/google/browser/complete", {
    method: "POST",
    headers: {
      origin: "https://happinotes.online",
      "content-type": "application/json",
      cookie: `${cookie}=${secret}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });

test("page stays on the website and forwards only its session cookie and security headers", async () => {
  const response = await proxyGoogleBrowser(
    page(),
    "page",
    async (url, init) => {
      assert.equal(url.pathname, "/auth/google/browser/page");
      assert.equal(init.headers.get("cookie"), `${cookie}=${secret}`);
      assert.equal(init.headers.get("authorization"), null);
      assert.equal(init.redirect, "error");
      assert.equal(init.cache, "no-store");
      return new Response("<html>Firebase sign-in</html>", {
        headers: {
          "content-type": "text/html",
          "content-security-policy": "script-src 'nonce-safe'",
          "cross-origin-opener-policy": "same-origin-allow-popups",
          "set-cookie": `${cookie}=${secret}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("content-security-policy"),
    "script-src 'nonce-safe'",
  );
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
});

test("completion forwards origin and minimal payload and clears the correct browser cookie", async () => {
  const response = await proxyGoogleBrowser(
    complete(
      {},
      { sessionId: id, cancelled: true, adminToken: "do not forward" },
    ),
    "complete",
    async (_, init) => {
      assert.equal(init.headers.get("origin"), "https://happinotes.online");
      assert.deepEqual(JSON.parse(init.body), {
        sessionId: id,
        cancelled: true,
      });
      return Response.json(
        { success: true, debug: "https://internal.example" },
        {
          headers: {
            "set-cookie": `${cookie}=; Path=/; Secure; HttpOnly; Max-Age=0`,
          },
        },
      );
    },
  );
  assert.deepEqual(await response.json(), { success: true });
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("foreign origins, invalid sessions, unsupported routes and oversized bodies never reach backend", async () => {
  let calls = 0;
  const upstream = async () => {
    calls++;
    return Response.json({});
  };
  for (const origin of [
    "https://evil.example",
    "null",
    "https://www.happinotes.online",
  ])
    assert.equal(
      (await proxyGoogleBrowser(complete({ origin }), "complete", upstream))
        .status,
      403,
    );
  assert.equal(
    (
      await proxyGoogleBrowser(
        complete({}, { sessionId: "../start", cancelled: true }),
        "complete",
        upstream,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await proxyGoogleBrowser(
        complete({}, { sessionId: id, firebaseIdToken: "x".repeat(17000) }),
        "complete",
        upstream,
      )
    ).status,
    400,
  );
  assert.equal(
    (await proxyGoogleBrowser(page(), "start", upstream)).status,
    404,
  );
  assert.equal(
    (await proxyGoogleBrowser(page(), "complete", upstream)).status,
    404,
  );
  assert.equal(calls, 0);
});

test("upstream failures and redirects never expose backend addresses or error diagnostics", async () => {
  for (const request of [page(), complete()]) {
    const response = await proxyGoogleBrowser(
      request,
      request.method === "GET" ? "page" : "complete",
      async () =>
        new Response("https://private.railway.app stack trace", {
          status: 500,
        }),
    );
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /railway|stack|https:/);
  }
  const response = await proxyGoogleBrowser(page(), "page", async () => {
    throw new Error("redirect to https://private.railway.app");
  });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /railway/);
});

test("unrelated or domain-wide cookies are not relayed to the website", async () => {
  const headers = new Headers({ "content-type": "text/html" });
  headers.append("set-cookie", "adminToken=private; Secure");
  headers.append(
    "set-cookie",
    `${cookie}=${secret}; Domain=happinotes.online; Secure`,
  );
  const response = await proxyGoogleBrowser(
    page(),
    "page",
    async () => new Response("<html></html>", { headers }),
  );
  assert.equal(response.headers.get("set-cookie"), null);
});

test("relative client API configuration cannot break the server-side sign-in proxy", async () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "/api/backend";
  try {
    const response = await proxyGoogleBrowser(page(), "page", async (url) => {
      assert.equal(url.protocol, "https:");
      return new Response("<html>Sign in</html>", {
        headers: { "content-type": "text/html" },
      });
    });
    assert.equal(response.status, 200);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});
