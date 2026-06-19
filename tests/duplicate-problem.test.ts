/**
 * Unit tests for duplicate_problem: clones a problem into the caller's library
 * via POST /problems/:id/duplicate. Interviewer-only (problem authoring), so it
 * is not registered for the candidate or general profiles.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { registerDuplicateProblem } from '../src/tools/duplicate_problem.ts';
import type { TypeletsClient } from '../src/client.ts';
import type { Env } from '../src/env.ts';

interface Rec {
  name: string;
  handler: (i: unknown) => Promise<unknown>;
}
function fakeServer() {
  const registered: Rec[] = [];
  return {
    registered,
    registerTool: (name: string, _m: unknown, h: Rec['handler']) =>
      registered.push({ name, handler: h }),
  };
}
function fakeClient(impl: Partial<TypeletsClient> = {}): TypeletsClient {
  const no = async (): Promise<never> => {
    throw new Error('not impl');
  };
  return {
    get: impl.get ?? no,
    post: impl.post ?? no,
    put: impl.put ?? no,
    patch: impl.patch ?? no,
    delete: impl.delete ?? no,
  };
}
const interviewer: Env = { token: 't', apiUrl: 'https://api', profile: 'interviewer' };

describe('duplicate_problem', () => {
  it('POSTs /problems/:id/duplicate', async () => {
    let path = '';
    const c = fakeClient({
      post: async (p: string) => {
        path = p;
        return {
          problem: {
            id: 'p2',
            slug: 's-copy',
            title: 'X (copy)',
            difficulty: 'easy',
            category: 'frontend',
            tags: [],
          },
        };
      },
    });
    const s = fakeServer();
    registerDuplicateProblem(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'duplicate_problem');
    assert.ok(t);
    await t!.handler({ problemId: 'p1' });
    assert.equal(path, '/problems/p1/duplicate');
  });

  it('is interviewer-only (not registered for candidate or general)', () => {
    for (const profile of ['candidate', 'general'] as const) {
      const s = fakeServer();
      registerDuplicateProblem(s as never, fakeClient(), { ...interviewer, profile });
      assert.equal(
        s.registered.find((r) => r.name === 'duplicate_problem'),
        undefined,
      );
    }
  });
});
