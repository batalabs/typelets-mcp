/**
 * list_recordings — return the recordings made in a workspace.
 *
 * Metadata only: id, label, createdAt, durationMs, and the count of
 * captured events. The actual event-stream blob endpoint stays out of
 * Phase 1; downloading and replaying a session is a Phase 3 concern
 * because it pairs naturally with transcript summarisation tools.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface RecordingSummary {
  id: string;
  label?: string | null;
  createdAt: string;
  durationMs: number;
  eventCount: number;
}

interface ListRecordingsResponse {
  recordings: RecordingSummary[];
}

export function registerListRecordings(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'list_recordings',
    {
      title: 'List session recordings',
      description:
        "Return every saved session recording for a workspace, metadata only. The recordings themselves stay out of the Phase 1 surface — call out to the platform to replay them.",
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
      },
    },
    async ({ workspaceId }) => {
      try {
        const { recordings } = await client.get<ListRecordingsResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/recordings`,
        );
        return ok(
          `Found ${recordings.length} recording${recordings.length === 1 ? '' : 's'}.`,
          { recordings },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
