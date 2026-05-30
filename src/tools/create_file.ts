/**
 * create_file — create a new file at a path in a workspace.
 *
 * Available to both interviewer and candidate profiles — candidates have
 * editor role in their own interview workspace and need to create files.
 * Intermediate folders are created automatically; returns the new file id.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface CreateFileResponse {
  id: string;
  path: string;
  type: 'file';
  parentId: string | null;
}

export function registerCreateFile(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('create_file', env.profile)) return;

  server.registerTool(
    'create_file',
    {
      title: 'Create a file in a workspace',
      description:
        'Create a new file at a slash-separated path in a workspace. Folders are created as needed. Returns the new file id. Errors: 409 if a file already exists at the path (use update_file instead); 413 if content exceeds 1 MiB.',
      inputSchema: {
        workspaceId: z.string().describe('The workspace id from list_workspaces.'),
        path: z.string().min(1).describe('Slash-separated path from the workspace root (e.g. "src/lib/auth.ts"). Cannot contain ".." segments.'),
        content: z.string().optional().describe('Initial UTF-8 content. Omit to create an empty placeholder file that the y-websocket server will materialise on first open.'),
      },
    },
    async ({ workspaceId, path, content }) => {
      try {
        const body: { path: string; content?: string } = { path };
        if (content !== undefined) body.content = content;
        const result = await client.post<CreateFileResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files`,
          body,
        );
        return ok(`Created ${result.path} (id=${result.id}).`, { file: result });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
