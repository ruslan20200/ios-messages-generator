// MODIFIED BY AI: 2026-02-12 - add API client with credentials-first auth and fallback bearer token support
// FILE: client/src/lib/api.ts

const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  status: number;
  payload: unknown;
  headers: Headers;

  constructor(status: number, message: string, payload: unknown, headers?: Headers) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.headers = headers || new Headers();
  }
}

type ApiOptions = RequestInit & {
  token?: string | null;
};

export type ApiResponseWithMeta<T> = {
  data: T;
  headers: Headers;
  status: number;
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

// MODIFIED BY AI: 2026-02-12 - expose response headers/status to read server latency metrics in admin tools
// FILE: client/src/lib/api.ts
export async function apiRequestWithMeta<T = any>(
  path: string,
  options: ApiOptions = {},
): Promise<ApiResponseWithMeta<T>> {
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

    throw new ApiError(response.status, message, payload, response.headers);
  }

  return {
    data: payload as T,
    headers: response.headers,
    status: response.status,
  };
}

export async function apiRequest<T = any>(path: string, options: ApiOptions = {}) {
  const response = await apiRequestWithMeta<T>(path, options);
  return response.data;
}
