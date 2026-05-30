/**
 * get_problem: fetch the full detail for a single library problem.
 *
 * In `interviewer` profile, returns prompt + rubric + criteria + visible
 * and hidden tests + solution metadata. In `candidate` profile the
 * rubric, criteria, hidden tests, and solution are stripped before
 * leaving this process. The LLM never sees them. The filtering is in
 * `profile.ts`; this handler just forwards the result through it.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { filterProblemForProfile, type ProblemDetailLike } from '../profile.js';
import { ok, fail } from './_shared.js';

interface GetProblemResponse {
  problem: ProblemDetailLike;
}

export function registerGetProblem(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  server.registerTool(
    'get_problem',
    {
      title: 'Get library problem',
      description:
        'Fetch the full detail of a library problem by id. In the interviewer profile the response includes rubric, criteria, hidden tests, and solution metadata; in the candidate profile those fields are stripped before the response leaves this server.',
      inputSchema: {
        problemId: z.string().min(1).describe('The library problem id.'),
      },
    },
    async ({ problemId }) => {
      try {
        const { problem } = await client.get<GetProblemResponse>(
          `/problems/${encodeURIComponent(problemId)}`,
        );
        const filtered = filterProblemForProfile(problem, env);
        const note =
          env.profile === 'candidate'
            ? ' (candidate profile: rubric, criteria, hidden tests, and solution stripped)'
            : '';
        return ok(`Problem "${filtered.title}" (${filtered.difficulty})${note}.`, {
          problem: filtered,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
