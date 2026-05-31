/**
 * delete_folder: recursively delete a folder and everything under it.
 * Destructive. Both profiles (editors manage their own tree).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface DeleteFolderResponse {
  deleted: number;
}

export function registerDeleteFolder(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('delete_folder', env.profile)) return;

  server.registerTool(
    'delete_folder',
    {
      title: 'Delete a folder (recursive)',
      description:
        'Permanently delete a folder and ALL files and subfolders inside it. Get folderId from list_workspace_files with includeFolders=true. This cannot be undone.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        folderId: z
          .string()
          .min(1)
          .describe('The folder id from list_workspace_files (includeFolders=true).'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId, folderId }) => {
      try {
        const out = await client.delete<DeleteFolderResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/folders/${encodeURIComponent(folderId)}`,
        );
        return ok(`Deleted folder and ${out.deleted} item(s).`, out);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
