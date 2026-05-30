/**
 * score_against_rubric: return a structured timeline plus the workspace's
 * inline interview rubric + criteria so the host LLM can score the
 * candidate against per-criterion.
 *
 * Workspaces with no inline rubric or criteria are not scorable - the
 * apply-problem handler copies rubric/criteria onto the workspace
 * directly; bare workspaces have nothing meaningful to score against.
 * The api returns 404 + code=no_source_problem in that case, which we
 * translate to a friendly error so the host LLM nudges the user to
 * apply or save a problem first.
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

interface ScoreTimelineResponse {
  recording: { id: string; durationMs: number };
  workspace: { id: string; name: string };
  files: { docName: string; checkpoints: unknown[] }[];
  runs: unknown[];
  truncated: boolean;
  problem: {
    prompt: string;
    rubric: string | null;
    criteria: { name: string; description: string }[];
  };
}

function isNoSourceProblem(err: unknown): boolean {
  return (
    err instanceof TypeletsApiError &&
    err.status === 404 &&
    err.body !== null &&
    typeof err.body === 'object' &&
    (err.body as { code?: string }).code === 'no_source_problem'
  );
}

export function registerScoreAgainstRubric(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  if (!toolAllowedForProfile('score_against_rubric', env.profile)) return;

  server.registerTool(
    'score_against_rubric',
    {
      title: 'Score a recording against the rubric',
      description:
        "Fetch the structured timeline of a recording plus the workspace's inline interview rubric + criteria, so the host LLM can score the candidate per criterion. Only works on workspaces that have a problem applied (use apply_problem_to_workspace or save_problem_to_library first if needed).",
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
        const payload = await client.get<ScoreTimelineResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/timeline?mode=score&samples=10`,
        );
        const summary = `Loaded recording ${recordingId} and rubric for workspace ${payload.workspace.name} (${payload.problem.criteria.length} criteria).`;
        return ok(summary, payload);
      } catch (err) {
        if (isNoSourceProblem(err)) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'This workspace is not derived from a problem (no rubric or criteria attached), so there is no rubric to score against. Apply a problem to the workspace first.',
              },
            ],
            structuredContent: { error: { code: 'no_source_problem' } },
          };
        }
        return fail(err);
      }
    },
  );
}
