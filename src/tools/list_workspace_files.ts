/**
 * list_workspace_files: walk a workspace's tree and return flat paths.
 *
 * Phase 1 calls the snapshot endpoint `GET /workspaces/:id/files` which
 * the Typelets API exposes specifically for non-Yjs consumers (the
 * collaborative tree is the source of truth; this endpoint returns a
 * point-in-time materialised view of it).
 *
 * Returns file ids alongside paths so a follow-up `read_workspace_file`
 * call can fetch contents by id (cheaper + immune to mid-call renames).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface WorkspaceFileEntry {
  id: string;
  path: string;
  type: 'file' | 'folder' | 'whiteboard';
  parentId: string | null;
}

interface ListWorkspaceFilesResponse {
  files: WorkspaceFileEntry[];
}

export function registerListWorkspaceFiles(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'list_workspace_files',
    {
      title: 'List workspace files',
      description:
        'Return every file, folder, and whiteboard in a workspace as a flat list of slash-separated paths plus stable ids. Use the id with read_workspace_file to fetch contents.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        includeFolders: z
          .boolean()
          .optional()
          .describe('Include folder + whiteboard entries. Default false: files only.'),
      },
    },
    async ({ workspaceId, includeFolders }) => {
      try {
        const { files } = await client.get<ListWorkspaceFilesResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files`,
        );
        const filtered =
          includeFolders === true ? files : files.filter((f) => f.type === 'file');
        return ok(
          `Found ${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}.`,
          { files: filtered },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
