const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const isDevelopmentBuild = typeof __DEV__ !== "undefined" && __DEV__;

if (!configuredApiUrl && !isDevelopmentBuild) {
  throw new Error("EXPO_PUBLIC_API_URL must be set for test and store builds.");
}

const apiUrl = configuredApiUrl || "http://localhost:3000/api";
const parsedApiUrl = new URL(apiUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

if (!isDevelopmentBuild && localHosts.has(parsedApiUrl.hostname)) {
  throw new Error("Test and store builds cannot use a localhost API URL.");
}

export const API_BASE_URL = apiUrl.replace(/\/$/, "");

export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");
