/**
 * read_workspace_file: return the contents of a single workspace file.
 *
 * Backed by `GET /workspaces/:id/files/:fileId/content`. The Typelets
 * API returns the materialised UTF-8 content of the file at HEAD;
 * binary files are rejected with a 415 (the MCP transport is text-only
 * and the model can't reason about raw bytes anyway).
 *
 * Long files are truncated server-side; the response carries a
 * `truncated: true` flag in that case so the model can ask for a
 * follow-up range if needed.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface ReadWorkspaceFileResponse {
  path: string;
  content: string;
  truncated: boolean;
  bytes: number;
}

export function registerReadWorkspaceFile(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'read_workspace_file',
    {
      title: 'Read workspace file',
      description:
        'Fetch the UTF-8 contents of a single file in a workspace. Use list_workspace_files first to obtain the fileId. Binary files are rejected; long files may be truncated.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        fileId: z.string().min(1).describe('The file id from list_workspace_files.'),
      },
    },
    async ({ workspaceId, fileId }) => {
      try {
        const payload = await client.get<ReadWorkspaceFileResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(fileId)}/content`,
        );
        const summary = payload.truncated
          ? `Read ${payload.path} (${payload.bytes} bytes, TRUNCATED).`
          : `Read ${payload.path} (${payload.bytes} bytes).`;
        return ok(summary, payload);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
