/* ═══════════════════════════════════════════════════════
   LedgerLand — API Client
   Thin fetch wrapper with auth header injection
   ═══════════════════════════════════════════════════════ */

const TOKEN_KEY = "ll_token";

/** Get stored JWT token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store JWT token */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove JWT token */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Structured API error */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super((body.error as string) || `API Error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Core fetch wrapper.
 * - Prepends `/api` prefix
 * - Injects Authorization header when token exists
 * - Parses JSON, throws ApiError on non-2xx
 */
async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  // Handle file downloads (non-JSON responses)
  const contentType = res.headers.get("content-type") || "";
  if (
    res.ok &&
    !contentType.includes("application/json")
  ) {
    return res as unknown as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

/* ── Typed convenience helpers ───────────────────────── */

export const api = {
  get<T = unknown>(path: string) {
    return apiFetch<T>(path);
  },

  post<T = unknown>(path: string, data?: unknown) {
    return apiFetch<T>(path, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  },

  patch<T = unknown>(path: string, data?: unknown) {
    return apiFetch<T>(path, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  put<T = unknown>(path: string, data?: unknown) {
    return apiFetch<T>(path, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /** Download a file (returns raw Response for blob handling) */
  async download(path: string): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body);
    }
    return res;
  },
};
