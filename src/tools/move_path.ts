/**
 * move_path: rename or move a file/folder to a new path. The destination's
 * parent folders are created as needed. Works on files and folders alike.
 * Available to both profiles (editors manage their own tree).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface MoveResponse {
  id: string;
  path: string;
  type: string;
  parentId: string | null;
}

export function registerMovePath(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('move_path', env.profile)) return;

  server.registerTool(
    'move_path',
    {
      title: 'Move or rename a file or folder',
      description:
        'Move or rename a node (file OR folder) to a new full path. Parent folders are created as needed. Get nodeId from list_workspace_files (use includeFolders for folders). Moving a folder into its own subtree is rejected.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        nodeId: z.string().min(1).describe('The file or folder id from list_workspace_files.'),
        destinationPath: z
          .string()
          .min(1)
          .describe('Full destination path, e.g. "src/lib/auth.ts".'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ workspaceId, nodeId, destinationPath }) => {
      try {
        const out = await client.post<MoveResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/move`,
          { nodeId, destinationPath },
        );
        return ok(`Moved to ${out.path}.`, out);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
