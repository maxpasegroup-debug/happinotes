import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { clearAuth, JWT_TOKEN_KEY } from "@/store/authStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

type ApiOptions = RequestInit & {
  skipAuth?: boolean;
};

export type ApiResult<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export const getToken = async () => {
  return AsyncStorage.getItem(JWT_TOKEN_KEY);
};

const parseResponse = async <T>(response: Response): Promise<ApiResult<T>> => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    return {
      success: false,
      data: null,
      error: payload.message || payload.error || "Something went wrong",
    };
  }

  return {
    success: true,
    data: payload as T,
    error: null,
  };
};

export const authFetch = async <T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResult<T>> => {
  try {
    const token = options.skipAuth ? null : await getToken();
    const headers = new Headers(options.headers);

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && !options.skipAuth) {
      await clearAuth();
      router.replace("/");
    }

    return parseResponse<T>(response);
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
};

export const api = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    authFetch<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    authFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    authFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(endpoint: string, options?: ApiOptions) =>
    authFetch<T>(endpoint, { ...options, method: "DELETE" }),
  upload: <T>(endpoint: string, file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    return authFetch<T>(endpoint, { method: "POST", body: form });
  },
};
