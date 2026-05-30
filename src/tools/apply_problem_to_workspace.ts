/**
 * apply_problem_to_workspace — apply a library problem to an interview workspace.
 *
 * Interviewer-only. Materializes the problem's starter + test files into the
 * workspace tree, sets the interview prompt/rubric/criteria/tests on the
 * workspace, and REPLACES any previously applied files. This is destructive —
 * a co-editor's in-progress work may be clobbered.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface WorkspaceSummary {
  id: string;
  name: string;
  mode: string;
  interviewPrompt?: string | null;
}

interface ApplyProblemResponse {
  workspace: WorkspaceSummary;
}

export function registerApplyProblemToWorkspace(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate — keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('apply_problem_to_workspace', env.profile)) return;

  server.registerTool(
    'apply_problem_to_workspace',
    {
      title: 'Apply a library problem to an interview workspace',
      description:
        'Apply a library problem to an interview workspace. Materializes the problem\'s starter files ' +
        'and test files into the workspace tree and copies the prompt, rubric, criteria, and test cases ' +
        'onto the workspace. Existing candidate work in the workspace is REPLACED — any previously ' +
        'applied starter files are removed and the new ones are written in a single atomic pass. ' +
        'Destructive — confirm before invoking. Errors: 404 if the workspace or problem is not found; ' +
        '403 if the caller is not owner/admin/interviewer of the workspace.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id from list_workspaces or create_workspace. Must be an interview-mode workspace.'),
        problemId: z.string().min(1).describe('The problem id or slug from list_problems. Accepts either the cuid or the slug.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId, problemId }) => {
      try {
        const result = await client.post<ApplyProblemResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/interview/problem`,
          { problemId },
        );
        return ok(
          `Applied problem to workspace ${workspaceId}.`,
          { workspace: result.workspace },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
