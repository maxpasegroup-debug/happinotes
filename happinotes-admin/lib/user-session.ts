export type WebUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: "admin" | "user";
  subscriptionActive?: boolean;
  subscriptionExpiry?: string | null;
};

const TOKEN_KEY = "user_token";
const USER_KEY = "user_profile";

export function getUserToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setUserSession(token: string, user: WebUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): WebUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebUser;
  } catch {
    return null;
  }
}

export function clearUserSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
