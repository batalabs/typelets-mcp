/**
 * delete_problem: delete a problem from the library.
 *
 * Interviewer-only. PERMANENT: the problem is removed from the library.
 * Workspaces that previously applied it keep their copy of the prompt,
 * criteria, and files; the deletion only removes the library entry.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

export function registerDeleteProblem(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate: keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('delete_problem', env.profile)) return;

  server.registerTool(
    'delete_problem',
    {
      title: 'Delete a problem from the library',
      description:
        'Delete a problem from the Typelets library. PERMANENT: the problem is removed and cannot ' +
        'be restored. Workspaces that previously applied it keep their copy of the ' +
        'prompt, criteria, and files. ' +
        'Errors: 403 if you are not the author (or not an org admin for shared-library problems); ' +
        '404 if the problem is not found.',
      inputSchema: {
        problemId: z.string().min(1).describe('The problem id or slug from list_problems.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ problemId }) => {
      try {
        await client.delete<void>(`/problems/${encodeURIComponent(problemId)}`);
        return ok(`Deleted problem ${problemId}.`, { deleted: true, problemId });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
