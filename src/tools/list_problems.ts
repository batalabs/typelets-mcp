/**
 * list_problems: return library entries the caller can see.
 *
 * Respects the existing API-side scoping (system library vs. org
 * library) plus the candidate profile when active (the profile gate is
 * a list-level no-op; the per-problem filtering happens in get_problem).
 *
 * Optional filters mirror the in-app picker: category, difficulty,
 * scope (system / org / all). The model can call this iteratively to
 * narrow down before a get_problem.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface ProblemSummary {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  visibility: 'shared' | 'org';
  tags?: string[];
}

interface ListProblemsResponse {
  problems: ProblemSummary[];
}

const DIFFICULTY = z.enum(['easy', 'medium', 'hard']);

export function registerListProblems(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'list_problems',
    {
      title: 'List library problems',
      description:
        'Return the problem-library entries the caller can see. Optional filters: category, difficulty, scope (system / org / all). The candidate profile sees the same listing as the interviewer profile here; rubric / hidden tests are stripped at the get_problem stage.',
      inputSchema: {
        difficulty: DIFFICULTY.optional().describe('Filter by difficulty.'),
        category: z
          .string()
          .optional()
          .describe('Filter by category enum (e.g. "arrays_strings", "trees").'),
        scope: z
          .enum(['all', 'shared', 'org'])
          .optional()
          .describe('"shared" = the system library; "org" = scoped to the caller\'s active org.'),
      },
    },
    async ({ difficulty, category, scope }) => {
      try {
        const { problems } = await client.get<ListProblemsResponse>('/problems');
        const filtered = problems.filter((p) => {
          if (difficulty !== undefined && p.difficulty !== difficulty) return false;
          if (category !== undefined && p.category !== category) return false;
          if (scope !== undefined && scope !== 'all' && p.visibility !== scope) return false;
          return true;
        });
        return ok(
          `Found ${filtered.length} problem${filtered.length === 1 ? '' : 's'} matching the filter.`,
          { problems: filtered },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
