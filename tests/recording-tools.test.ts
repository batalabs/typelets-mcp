/**
 * Unit tests for the three Phase 3 session-intelligence tools. Each tool
 * is a thin wrapper around a /timeline endpoint. We verify:
 *   - the tool calls the right path with the right query params
 *   - structured response shape (summary text + JSON in content)
 *   - error mapping: no_source_problem and no_active_recording produce
 *     friendly text, not raw API error blobs
 *   - profile gating: candidate profile does not register any of the three
 *
 * NOTE: Tasks 3 and 4 will create score_against_rubric.ts and
 * suggest_followup_questions.ts. On this commit (Task 2), those imports
 * will fail to resolve - that's expected per the plan; Tasks 3 and 4
 * fill them in.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { registerSummarizeRecording } from '../src/tools/summarize_recording.ts';
import { registerScoreAgainstRubric } from '../src/tools/score_against_rubric.ts';
import { registerSuggestFollowupQuestions } from '../src/tools/suggest_followup_questions.ts';
import { TypeletsApiError, type TypeletsClient } from '../src/client.ts';
import type { Env } from '../src/env.ts';

interface FakeServer {
  registered: Array<{ name: string; handler: (input: unknown) => Promise<unknown> }>;
  registerTool: (name: string, _meta: unknown, handler: (input: unknown) => Promise<unknown>) => void;
}

function makeFakeServer(): FakeServer {
  const registered: FakeServer['registered'] = [];
  return {
    registered,
    registerTool: (name, _meta, handler) => {
      registered.push({ name, handler });
    },
  };
}

function makeFakeClient(impl: Partial<TypeletsClient> = {}): TypeletsClient {
  const notImpl = async (): Promise<never> => {
    throw new Error('not implemented in test');
  };
  return {
    get: impl.get ?? notImpl,
    post: impl.post ?? notImpl,
    put: impl.put ?? notImpl,
    patch: impl.patch ?? notImpl,
    delete: impl.delete ?? notImpl,
  };
}

const interviewerEnv: Env = {
  token: 't',
  apiUrl: 'https://api',
  profile: 'interviewer',
};
const candidateEnv: Env = { ...interviewerEnv, profile: 'candidate' };

describe('summarize_recording', () => {
  it('calls /timeline?mode=summary&samples=10 with the recording id', async () => {
    let lastPath = '';
    const client = makeFakeClient({
      get: async (path: string) => {
        lastPath = path;
        return {
          recording: { id: 'r1', durationMs: 1000, eventCount: 0 },
          workspace: { id: 'w1', name: 'tw' },
          files: [],
          runs: [],
          truncated: false,
        };
      },
    });
    const server = makeFakeServer();
    registerSummarizeRecording(server as never, client, interviewerEnv);

    const tool = server.registered.find((t) => t.name === 'summarize_recording');
    assert.ok(tool);
    await tool!.handler({ workspaceId: 'w1', recordingId: 'r1' });
    assert.equal(lastPath, '/workspaces/w1/recordings/r1/timeline?mode=summary&samples=10');
  });

  it('is not registered for candidate profile', () => {
    const server = makeFakeServer();
    registerSummarizeRecording(server as never, makeFakeClient(), candidateEnv);
    assert.equal(
      server.registered.find((t) => t.name === 'summarize_recording'),
      undefined,
    );
  });
});

describe('score_against_rubric', () => {
  it('calls /timeline?mode=score with the recording id', async () => {
    let lastPath = '';
    const client = makeFakeClient({
      get: async (path: string) => {
        lastPath = path;
        return {
          recording: { id: 'r1', durationMs: 1000 },
          workspace: { id: 'w1', name: 'tw' },
          files: [],
          runs: [],
          truncated: false,
          problem: {
            prompt: 'Two Sum',
            rubric: 'O(n)',
            criteria: [{ name: 'Correctness', description: 'Passes tests' }],
          },
        };
      },
    });
    const server = makeFakeServer();
    registerScoreAgainstRubric(server as never, client, interviewerEnv);

    const tool = server.registered.find((t) => t.name === 'score_against_rubric');
    assert.ok(tool);
    await tool!.handler({ workspaceId: 'w1', recordingId: 'r1' });
    assert.equal(lastPath, '/workspaces/w1/recordings/r1/timeline?mode=score&samples=10');
  });

  it('maps no_source_problem 404 to a user-friendly error', async () => {
    const client = makeFakeClient({
      get: async () => {
        throw new TypeletsApiError(404, 'no source', { error: 'no source', code: 'no_source_problem' });
      },
    });
    const server = makeFakeServer();
    registerScoreAgainstRubric(server as never, client, interviewerEnv);

    const tool = server.registered.find((t) => t.name === 'score_against_rubric');
    assert.ok(tool);
    const res = (await tool!.handler({ workspaceId: 'w1', recordingId: 'r1' })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    assert.equal(res.isError, true);
    assert.match(res.content[0]!.text, /not derived from a problem|no rubric/i);
  });

  it('is not registered for candidate profile', () => {
    const server = makeFakeServer();
    registerScoreAgainstRubric(server as never, makeFakeClient(), candidateEnv);
    assert.equal(
      server.registered.find((t) => t.name === 'score_against_rubric'),
      undefined,
    );
  });
});

describe('suggest_followup_questions', () => {
  it('calls /recordings/active/timeline?samples=6', async () => {
    let lastPath = '';
    const client = makeFakeClient({
      get: async (path: string) => {
        lastPath = path;
        return {
          recording: { id: 'live1', eventCount: 5 },
          workspace: { id: 'w1', name: 'tw', interviewPrompt: null },
          files: [],
          runs: [],
          truncated: false,
        };
      },
    });
    const server = makeFakeServer();
    registerSuggestFollowupQuestions(server as never, client, interviewerEnv);

    const tool = server.registered.find((t) => t.name === 'suggest_followup_questions');
    assert.ok(tool);
    await tool!.handler({ workspaceId: 'w1' });
    assert.equal(lastPath, '/workspaces/w1/recordings/active/timeline?samples=6');
  });

  it('maps no_active_recording 404 to a user-friendly error', async () => {
    const client = makeFakeClient({
      get: async () => {
        throw new TypeletsApiError(404, 'no active', { error: 'no active', code: 'no_active_recording' });
      },
    });
    const server = makeFakeServer();
    registerSuggestFollowupQuestions(server as never, client, interviewerEnv);

    const tool = server.registered.find((t) => t.name === 'suggest_followup_questions');
    assert.ok(tool);
    const res = (await tool!.handler({ workspaceId: 'w1' })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    assert.equal(res.isError, true);
    assert.match(res.content[0]!.text, /No active recording/);
  });

  it('is not registered for candidate profile', () => {
    const server = makeFakeServer();
    registerSuggestFollowupQuestions(server as never, makeFakeClient(), candidateEnv);
    assert.equal(
      server.registered.find((t) => t.name === 'suggest_followup_questions'),
      undefined,
    );
  });
});
