/**
 * summarize_recording: return a structured timeline of a frozen recording.
 *
 * The host LLM consumes the JSON and writes the actual prose summary. The
 * tool itself just calls the api's /timeline?mode=summary endpoint and
 * passes the response through.
 *
 * Interviewer-only.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface TimelineResponse {
  recording: { id: string; durationMs: number; eventCount: number };
  workspace: { id: string; name: string };
  files: { docName: string; checkpoints: unknown[] }[];
  runs: { runId: string }[];
  truncated: boolean;
}

export function registerSummarizeRecording(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  if (!toolAllowedForProfile('summarize_recording', env.profile)) return;

  server.registerTool(
    'summarize_recording',
    {
      title: 'Summarize a recording',
      description:
        'Fetch a structured timeline of a recorded interview session for the host LLM to summarize. Includes per-file content checkpoints sampled across the session and a chronological list of Run-button invocations. Use list_recordings first to obtain the recordingId.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
        recordingId: z
          .string()
          .min(1)
          .describe('The recording id from list_recordings.'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ workspaceId, recordingId }) => {
      try {
        const payload = await client.get<TimelineResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/timeline?mode=summary&samples=10`,
        );
        const summary = `Loaded recording ${recordingId} for workspace ${payload.workspace.name} (${payload.runs.length} runs across ${payload.files.length} files, ${payload.recording.durationMs}ms).`;
        return ok(summary, payload);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
