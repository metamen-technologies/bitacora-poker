export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly issues: Array<{ field: string; message: string }> = []) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "No se pudo completar la operación local" }));
    throw new ApiError(body.error ?? "No se pudo completar la operación local", response.status, body.issues ?? []);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function downloadUrl(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
