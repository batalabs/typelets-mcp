/**
 * create_folder: create an empty folder (with intermediate folders) at a path.
 * Idempotent if the folder already exists. Both profiles.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface FolderResponse {
  id: string;
  path: string;
  type: 'folder';
  parentId: string | null;
}

export function registerCreateFolder(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('create_folder', env.profile)) return;

  server.registerTool(
    'create_folder',
    {
      title: 'Create a folder',
      description:
        'Create an empty folder at a slash-separated path; intermediate folders are created as needed. Idempotent if the folder already exists. Errors if a file occupies the path.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        path: z.string().min(1).describe('Folder path, e.g. "src/lib".'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ workspaceId, path }) => {
      try {
        const out = await client.post<FolderResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/folders`,
          { path },
        );
        return ok(`Created folder ${out.path}.`, out);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
