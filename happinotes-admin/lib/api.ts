const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getUrl(endpoint: string): string {
  return endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
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
  if (typeof parsed === "string" && parsed) return parsed;
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

  const res = await fetch(getUrl(endpoint), options);
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

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
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
