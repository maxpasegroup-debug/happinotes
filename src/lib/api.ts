const BASE_URL = "https://happinotes-production.up.railway.app";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest<T = any>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: any,
  token?: string
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      (parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as any).message === "string" &&
        (parsed as any).message) ||
      (typeof parsed === "string" && parsed) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

export { BASE_URL };

