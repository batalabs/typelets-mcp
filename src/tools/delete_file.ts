/**
 * delete_file — remove a file from a workspace.
 *
 * Available to both interviewer and candidate profiles. Idempotent: if the
 * file id no longer exists in the workspace the server returns 204 without
 * error. Marked destructive because the delete is permanent from the MCP
 * server's perspective.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

export function registerDeleteFile(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('delete_file', env.profile)) return;

  server.registerTool(
    'delete_file',
    {
      title: 'Delete a file from a workspace',
      description:
        'Permanently delete a file from a workspace. This action is idempotent — if the file id no longer exists the operation still succeeds silently. The deletion is immediate and cannot be undone via this tool.',
      inputSchema: {
        workspaceId: z.string().describe('The workspace id from list_workspaces.'),
        fileId: z.string().describe('The file id from list_workspace_files.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId, fileId }) => {
      try {
        await client.delete<void>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(fileId)}`,
        );
        return ok(`Deleted file ${fileId} from workspace ${workspaceId}.`, { deleted: true });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
