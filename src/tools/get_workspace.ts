/**
 * get_workspace — fetch the full summary for a single workspace.
 *
 * Returns the applied problem id (when any), preview configuration,
 * and the candidate / interviewer membership state. Combine with
 * `list_workspace_files` to surface what a candidate has actually
 * been working on inside a workspace.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface WorkspaceDetail {
  id: string;
  name: string;
  mode: string;
  role: string;
  shareScope: string;
  interviewPrompt?: string | null;
  appliedProblemId?: string | null;
  defaultPreviewPort?: number | null;
  previewVisibility?: string;
  previewSlug?: string | null;
}

interface GetWorkspaceResponse {
  workspace: WorkspaceDetail;
}

export function registerGetWorkspace(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'get_workspace',
    {
      title: 'Get workspace',
      description:
        'Fetch the full workspace summary for a given id (use list_workspaces to discover ids). Returns role, share scope, applied problem id, and preview settings.',
      inputSchema: {
        workspaceId: z
          .string()
          .min(1)
          .describe('The workspace id, e.g. "cmpkojnzm0004iqsfa2o2z94n".'),
      },
    },
    async ({ workspaceId }) => {
      try {
        const { workspace } = await client.get<GetWorkspaceResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}`,
        );
        return ok(`Workspace "${workspace.name}" (${workspace.mode}).`, { workspace });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
