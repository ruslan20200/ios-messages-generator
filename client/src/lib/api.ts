// MODIFIED BY AI: 2026-02-12 - add API client with credentials-first auth and fallback bearer token support
// FILE: client/src/lib/api.ts

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type ApiOptions = RequestInit & {
  token?: string | null;
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

export async function apiRequest<T = any>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error || "")
        : "") || `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}
