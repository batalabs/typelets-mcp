/**
 * suggest_followup_questions: return a structured slice of the workspace's
 * ACTIVE recording (last 5 minutes of activity + current file state) so the
 * host LLM can propose questions for the interviewer to ask next.
 *
 * The api resolves the active recording for us; the tool takes only the
 * workspaceId. 404 with code=no_active_recording means the interviewer
 * hasn't started recording the session yet.
 *
 * Interviewer-only.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import { TypeletsApiError } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface LiveTimelineResponse {
  recording: { id: string; eventCount: number };
  workspace: { id: string; name: string; interviewPrompt: string | null };
  files: { docName: string; checkpoints: unknown[] }[];
  runs: unknown[];
  truncated: boolean;
}

function isNoActiveRecording(err: unknown): boolean {
  return (
    err instanceof TypeletsApiError &&
    err.status === 404 &&
    err.body !== null &&
    typeof err.body === 'object' &&
    (err.body as { code?: string }).code === 'no_active_recording'
  );
}

export function registerSuggestFollowupQuestions(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  if (!toolAllowedForProfile('suggest_followup_questions', env.profile)) return;

  server.registerTool(
    'suggest_followup_questions',
    {
      title: 'Suggest follow-up questions for the active recording',
      description:
        "Fetch the last 5 minutes of activity from the workspace's active recording plus current file state, so the host LLM can suggest 2-3 follow-up questions the interviewer might ask. Requires an active recording; start one with the interview panel first.",
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id.'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ workspaceId }) => {
      try {
        const payload = await client.get<LiveTimelineResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/recordings/active/timeline?samples=6`,
        );
        const summary = `Loaded live timeline for workspace ${payload.workspace.name} (${payload.files.length} files in view).`;
        return ok(summary, payload);
      } catch (err) {
        if (isNoActiveRecording(err)) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'No active recording in this workspace. Start a recording with the interview panel first.',
              },
            ],
            structuredContent: { error: { code: 'no_active_recording' } },
          };
        }
        return fail(err);
      }
    },
  );
}
