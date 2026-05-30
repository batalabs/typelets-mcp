/**
 * Unit tests for the API client wrapper. Stub fetch with a controlled
 * Response so we can assert: the Authorization header lands, JSON
 * round-trips cleanly, and 4xx responses surface as TypeletsApiError
 * with the API's structured error message preserved.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { createClient, TypeletsApiError } from '../src/client.ts';
import type { Env } from '../src/env.ts';

const env: Env = {
  token: 'pat_test_value_long_enough_to_pass_the_min_check',
  apiUrl: 'https://api.example.test',
  profile: 'interviewer',
};

const originalFetch = globalThis.fetch;

interface StubCall {
  url: string;
  init: RequestInit | undefined;
}

let lastCall: StubCall | null = null;
let nextResponse: () => Response = () => new Response('{}');

before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    lastCall = {
      url: typeof input === 'string' ? input : input.toString(),
      init,
    };
    return nextResponse();
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe('createClient', () => {
  it('sends Authorization: Bearer <token> on GET', async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ workspaces: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const client = createClient(env);
    await client.get('/workspaces');
    const headers = lastCall?.init?.headers as Record<string, string> | undefined;
    assert.equal(headers?.['authorization'], `Bearer ${env.token}`);
    assert.equal(lastCall?.url, 'https://api.example.test/workspaces');
  });

  it('parses JSON response bodies', async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ ok: true, n: 3 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const client = createClient(env);
    const result = await client.get<{ ok: boolean; n: number }>('/anything');
    assert.equal(result.n, 3);
  });

  it('throws TypeletsApiError with the API message on 4xx', async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    const client = createClient(env);
    await assert.rejects(
      () => client.get('/missing'),
      (err: unknown) => {
        if (!(err instanceof TypeletsApiError)) return false;
        return err.status === 404 && err.message === 'not found';
      },
    );
  });

  it('returns undefined on 204', async () => {
    nextResponse = () => new Response(null, { status: 204 });
    const client = createClient(env);
    const result = await client.delete('/something');
    assert.equal(result, undefined);
  });
});
