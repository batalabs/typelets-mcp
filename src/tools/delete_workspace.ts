/**
 * delete_workspace: permanently delete a workspace. Interviewer-only and
 * destructive. Wraps the existing owner-gated DELETE /workspaces/:id (the api
 * returns 403 if the caller is not the owner).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

export function registerDeleteWorkspace(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  if (!toolAllowedForProfile('delete_workspace', env.profile)) return;

  server.registerTool(
    'delete_workspace',
    {
      title: 'Delete a workspace',
      description:
        'Permanently delete a workspace and all its files, recordings, and members. Only the workspace owner can do this. This cannot be undone.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id to permanently delete.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId }) => {
      try {
        await client.delete<void>(`/workspaces/${encodeURIComponent(workspaceId)}`);
        return ok('Workspace deleted.', { workspaceId, deleted: true });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
