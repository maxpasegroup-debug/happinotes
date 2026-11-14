const BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app").replace(/\/+$/, "");

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getUrl(endpoint: string): string {
  if (endpoint.startsWith("http")) return endpoint;
  // Keep local browser requests on the Next.js origin. Production still calls
  // the API directly, using its existing origin allowlist.
  const base = process.env.NODE_ENV === "development" && typeof window !== "undefined"
    ? "/api/backend"
    : BASE_URL;
  return `${base}${endpoint}`;
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(parsed: unknown, status: number): string {
  if (
    parsed &&
    typeof parsed === "object" &&
    "message" in parsed &&
    typeof (parsed as { message?: unknown }).message === "string"
  ) {
    return (parsed as { message: string }).message;
  }
  if (status === 413) return "The server or hosting provider rejected the file size. Check the server and storage account upload limits.";
  if (status === 408 || status === 504) return "The server or hosting provider timed out during the upload. Check its request timeout settings and try again.";
  return `Request failed with status ${status}`;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options: RequestInit = { method, headers };
  if (body !== undefined && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(getUrl(endpoint), options);
  } catch {
    throw new Error("Cannot reach the API. Check your connection and backend URL, then try again.");
  }
  const parsed = await parseResponse(res);
  if (!res.ok) throw new Error(readErrorMessage(parsed, res.status));
  return parsed as T;
}

export async function uploadMultipart<T = unknown>(
  endpoint: string,
  formData: FormData,
  token: string,
  onProgress?: (percent: number) => void,
  method: "POST" | "PUT" = "POST"
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, getUrl(endpoint), true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Large Happy Bites audio keeps the same progress events without a fixed
    // two-minute deadline; other upload workflows retain their timeout.
    xhr.timeout = endpoint === '/admin/contents/upload-happy-bite-audio' ? 0 : 120_000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0 || !onProgress) return;
      // Reserve 100% for upload completion, not rounded partial progress.
      const percent = Math.max(0, Math.min(99, Math.floor((event.loaded / event.total) * 100)));
      onProgress(percent);
    };
    xhr.upload.onload = () => onProgress?.(100);

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Check your connection and try again."));
    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = xhr.responseText;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(readErrorMessage(parsed, xhr.status)));
        return;
      }
      resolve(parsed as T);
    };

    xhr.send(formData);
  });
}

export { BASE_URL };
