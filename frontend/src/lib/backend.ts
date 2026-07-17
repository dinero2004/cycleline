import "server-only";

export class BackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

interface BackendOptions extends Omit<RequestInit, "body"> {
  token?: string;
  body?: unknown;
}

function backendBaseUrl() {
  return (process.env.BACKEND_URL ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");
}

export async function backendFetch<T>(path: string, options: BackendOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${backendBaseUrl()}/${path.replace(/^\//, "")}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: options.cache ?? "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    throw new BackendError(data.message ?? "The CycleLine API request failed.", response.status, data.errors);
  }

  return data as T;
}
