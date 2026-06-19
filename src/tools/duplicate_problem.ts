/**
 * duplicate_problem: clone any problem the caller can see into their current
 * org as a new, editable copy. This is the supported way to customize a
 * system/shared assessment, which is otherwise read-only (the API rejects
 * editing a shared problem). Maps to POST /problems/:id/duplicate (TYP-175).
 *
 * Interviewer-only (problem authoring).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
}

interface DuplicateProblemResponse {
  problem: ProblemDetail;
}

export function registerDuplicateProblem(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  // Profile gate: keep the string in sync with INTERVIEW_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('duplicate_problem', env.profile)) return;

  server.registerTool(
    'duplicate_problem',
    {
      title: 'Duplicate a problem into your library',
      description:
        'Clone any problem you can see (including a read-only system/shared assessment) into your ' +
        'current organization as a new, editable copy. The copy is owned by you (title suffixed with ' +
        '"(copy)", a fresh slug) and can then be changed with edit_problem. Use this to customize a ' +
        'system assessment, which cannot be edited in place. Errors: 404 if the problem is not visible ' +
        'to you; 409 if your account has no organization.',
      inputSchema: {
        problemId: z
          .string()
          .min(1)
          .describe('The problem id or slug from list_problems (may be a system/shared problem).'),
      },
    },
    async ({ problemId }) => {
      try {
        const result = await client.post<DuplicateProblemResponse>(
          `/problems/${encodeURIComponent(problemId)}/duplicate`,
        );
        return ok(
          `Duplicated into your library as "${result.problem.title}" (id=${result.problem.id}). ` +
            'Editable with edit_problem.',
          { problem: result.problem },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
