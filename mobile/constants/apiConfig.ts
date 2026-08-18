const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredApiUrl || "http://localhost:3000/api").replace(/\/$/, "");

export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");
