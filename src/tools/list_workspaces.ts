/**
 * list_workspaces — return every workspace the caller can see.
 *
 * Includes the caller's role per workspace (owner/admin/editor/viewer)
 * so the model can decide whether a follow-up write tool will be
 * allowed before attempting it.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface WorkspaceSummary {
  id: string;
  name: string;
  mode: string;
  role: string;
  shareScope: 'private' | 'org' | 'public';
  interviewPrompt?: string | null;
}

interface ListWorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

export function registerListWorkspaces(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'list_workspaces',
    {
      title: 'List workspaces',
      description:
        'Return every Typelets workspace the caller can access, with role + mode + sharing scope. Use this first to discover workspace ids.',
      inputSchema: {},
    },
    async () => {
      try {
        const { workspaces } = await client.get<ListWorkspacesResponse>('/workspaces');
        const summary =
          workspaces.length === 0
            ? 'The caller has no workspaces.'
            : `Found ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`;
        return ok(summary, { workspaces });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
