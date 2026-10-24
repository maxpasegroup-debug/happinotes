import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerAccount,
  loginCustomer,
  requestCustomerEmailOtp,
  verifyCustomerEmailOtp,
} from "../lib/customer-auth.ts";
import {
  clearUserSession,
  getStoredUser,
  getUserSessionSnapshot,
  getUserToken,
  setUserSession,
  subscribeToUserSession,
} from "../lib/user-session.ts";

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("customer signup follows email OTP verification and backend signup contracts", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (url.endsWith("/auth/request-email-otp")) return jsonResponse({ success: true, resendAfterSeconds: 60 });
    if (url.endsWith("/auth/verify-email-otp")) return jsonResponse({ success: true, emailChallenge: "challenge" });
    return jsonResponse({ success: true, token: "customer-session", user: { id: "u1", role: "user" } }, 201);
  };

  const requested = await requestCustomerEmailOtp("https://api.test", " Person@Example.test ", "signup", fetcher);
  const challenge = await verifyCustomerEmailOtp("https://api.test", " Person@Example.test ", "signup", "123456", fetcher);
  const result = await createCustomerAccount("https://api.test", {
    name: "Reader", email: " Person@Example.test ", password: "secret6", emailChallenge: challenge,
  }, fetcher);

  assert.equal(requested.resendAfterSeconds, 60);
  assert.equal(result.token, "customer-session");
  assert.deepEqual(calls.map((call) => call.url), [
    "https://api.test/auth/request-email-otp",
    "https://api.test/auth/verify-email-otp",
    "https://api.test/auth/signup",
  ]);
  assert.deepEqual(calls[0].body, { email: "person@example.test", purpose: "signup" });
  assert.deepEqual(calls[1].body, { email: "person@example.test", purpose: "signup", otp: "123456" });
  assert.deepEqual(calls[2].body, {
    name: "Reader", email: "person@example.test", password: "secret6", emailChallenge: "challenge",
  });
});

test("customer login uses email OTP challenge before email/password login", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith("/auth/request-email-otp")) return jsonResponse({ success: true, resendAfterSeconds: 60 });
    if (url.endsWith("/auth/verify-email-otp")) return jsonResponse({ emailChallenge: "login-challenge" });
    return jsonResponse({ token: "customer-session", user: { id: "u1", role: "user" } });
  };

  await requestCustomerEmailOtp("https://api.test", "reader@example.test", "login", fetcher);
  const emailChallenge = await verifyCustomerEmailOtp("https://api.test", "reader@example.test", "login", "987654", fetcher);
  const result = await loginCustomer("https://api.test", {
    email: "reader@example.test", password: "secret6", emailChallenge,
  }, fetcher);

  assert.equal(result.token, "customer-session");
  assert.deepEqual(calls[2].body, {
    email: "reader@example.test", password: "secret6", emailChallenge: "login-challenge",
  });
});

test("invalid or expired codes and backend resend cooldown errors remain visible", async () => {
  await assert.rejects(
    verifyCustomerEmailOtp("https://api.test", "reader@example.test", "login", "111111", async () =>
      jsonResponse({ message: "Invalid or expired OTP" }, 400)),
    /Invalid or expired OTP/,
  );
  await assert.rejects(
    requestCustomerEmailOtp("https://api.test", "reader@example.test", "signup", async () =>
      jsonResponse({ message: "Please wait 42 seconds before requesting another OTP" }, 429)),
    /Please wait 42 seconds/,
  );
});

test("customer session persists for customer pages and logout clears customer and admin tokens", () => {
  const values = new Map([["admin_token", "old-admin-session"]]);
  const listeners = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (event) => { listeners.get(event.type)?.(event); return true; },
  };

  let sessionChanges = 0;
  const unsubscribe = subscribeToUserSession(() => { sessionChanges += 1; });
  setUserSession("customer-session", { id: "u1", email: "reader@example.test", role: "user" });
  assert.equal(getUserToken(), "customer-session");
  assert.equal(getStoredUser().email, "reader@example.test");
  assert.equal(values.has("admin_token"), false);
  assert.match(getUserSessionSnapshot(), /customer-session/);
  clearUserSession();
  assert.equal(getUserToken(), null);
  assert.equal(getStoredUser(), null);
  assert.equal(values.has("admin_token"), false);
  assert.equal(sessionChanges, 2);
  unsubscribe();
  delete globalThis.window;
});
