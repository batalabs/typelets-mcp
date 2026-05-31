/**
 * append_to_file: append text to the end of a file without re-sending the
 * whole content. Both profiles.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface AppendResponse {
  id: string;
  bytes: number;
}

export function registerAppendToFile(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('append_to_file', env.profile)) return;

  server.registerTool(
    'append_to_file',
    {
      title: 'Append to a file',
      description:
        'Append text to the end of an existing file without re-sending its full content. Get fileId from list_workspace_files. The file must already exist (use create_file otherwise).',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        fileId: z.string().min(1).describe('The file id from list_workspace_files.'),
        text: z.string().min(1).describe('Text to append at the end of the file.'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ workspaceId, fileId, text }) => {
      try {
        const out = await client.patch<AppendResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(fileId)}/append`,
          { text },
        );
        return ok(`Appended to file (${out.bytes} bytes total).`, out);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
