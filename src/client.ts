/**
 * Thin fetch wrapper around the Typelets API. Adds the Authorization
 * header, JSON content-type, and a uniform error shape so individual
 * tool handlers don't have to repeat the same plumbing.
 *
 * The server intentionally does NOT cache responses. Each tool call is
 * a fresh request so the LLM never sees stale data, and the user keeps
 * a real-time view of platform state from inside the chat.
 */
import type { Env } from './env.js';

export class TypeletsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'TypeletsApiError';
  }
}

export interface TypeletsClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function createClient(env: Env): TypeletsClient {
  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${env.apiUrl}${path}`;
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${env.token}`,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let json: unknown = null;
    if (text.length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        // Non-JSON response body (HTML error page, plain text). Leave
        // json as null so the caller can decide whether to keep going
        // or fail; the raw text rides along on the error for debugging.
        json = text;
      }
    }

    if (!res.ok) {
      const message =
        (json !== null && typeof json === 'object' && 'error' in json && typeof json.error === 'string')
          ? json.error
          : `Typelets API ${method} ${path} failed with ${res.status}`;
      throw new TypeletsApiError(res.status, message, json);
    }

    return json as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
  };
}
