/**
 * update_file: replace the entire contents of an existing workspace file.
 *
 * Available to both interviewer and candidate profiles. Marked destructive
 * because the overwrite is irreversible from the MCP server's perspective.
 * a co-editor currently open on the file sees the change live and their
 * cursor position may be displaced.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface UpdateFileResponse {
  id: string;
  path: string;
  bytes: number;
}

export function registerUpdateFile(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate: keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('update_file', env.profile)) return;

  server.registerTool(
    'update_file',
    {
      title: "Replace a file's contents",
      description:
        "Replace the entire contents of a file with new UTF-8 text. Use create_file if the file does not exist yet. This overwrites wholesale: any co-editor currently editing the file sees the change live and their cursor may move; their in-flight edits are NOT preserved. Returns the new byte count. Errors: 404 if the fileId does not exist in the workspace; 413 if content exceeds 1 MiB.",
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id from list_workspaces.'),
        fileId: z.string().min(1).describe('The file id from list_workspace_files.'),
        content: z.string().describe('Replacement UTF-8 content. Wholesale overwrite; no diff/patch semantics.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId, fileId, content }) => {
      try {
        const result = await client.put<UpdateFileResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(fileId)}/content`,
          { content },
        );
        return ok(`Updated file ${result.path} (${result.bytes} bytes).`, { file: result });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
