/**
 * Type-safe helpers for narrowing unknown errors caught from API calls.
 *
 * Axios-style errors expose `err.response.data.detail` (or a custom message
 * field on our backend). These helpers let callers write
 * `getApiErrorMessage(err, "fallback")` without resorting to `any`.
 */

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      detail?: string | string[];
      message?: string;
    };
  };
}

function isApiError(err: unknown): err is ApiErrorShape {
  return typeof err === "object" && err !== null && "response" in err;
}

function isStringOrStringArray(value: unknown): value is string | string[] {
  return typeof value === "string" || (Array.isArray(value) && value.every((v) => typeof v === "string"));
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!isApiError(err)) return fallback;
  const data = err.response?.data;
  if (!data) return fallback;
  if (isStringOrStringArray(data.detail)) {
    return Array.isArray(data.detail) ? data.detail.join(", ") : data.detail;
  }
  if (typeof data.message === "string") return data.message;
  return fallback;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (!isApiError(err)) return undefined;
  return err.response?.status;
}

export function getApiErrorDetail(err: unknown, fallback: string): string {
  return getApiErrorMessage(err, fallback);
}
