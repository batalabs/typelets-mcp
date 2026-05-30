/**
 * save_problem_to_library: create a new problem in the library.
 *
 * Interviewer-only. The caller becomes the problem's owner and is the
 * only one who can later edit or delete it (org admins of the owning
 * Organization can also edit/delete org-visibility problems).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
}

interface SaveProblemResponse {
  problem: ProblemDetail;
}

const criterionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
});

const stdinTestCaseSchema = z.object({
  kind: z.literal('stdin').optional(),
  name: z.string().trim().min(1).max(120),
  stdin: z.string().max(20000),
  expectedStdout: z.string().max(20000),
  visible: z.boolean().default(true),
});

const frameworkTestCaseSchema = z.object({
  kind: z.literal('framework'),
  name: z.string().trim().min(1).max(120),
  framework: z.enum([
    'go', 'pytest', 'jest', 'vitest', 'rspec',
    'minitest', 'npm-test', 'rails', 'phpunit', 'other',
  ]),
  command: z.string().min(1).max(4000),
  visible: z.boolean().default(true),
});

const testCaseSchema = z.union([frameworkTestCaseSchema, stdinTestCaseSchema]);

const problemFileSchema = z.object({
  name: z.string().trim().min(1).max(512).describe('Slash-separated path from workspace root, e.g. "src/lib/foo.ts".'),
  content: z.string().max(1_048_576),
});

const categoryEnum = z.enum([
  'arrays_strings',
  'hash_tables',
  'linked_lists',
  'stacks_queues',
  'trees',
  'graphs',
  'recursion_dp',
  'sorting_searching',
  'math_bigo',
  'design',
  'ai',
  'data',
  'frontend',
  'backend',
  'systems',
  'sql',
  'other',
]);

export function registerSaveProblemToLibrary(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate: keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('save_problem_to_library', env.profile)) return;

  server.registerTool(
    'save_problem_to_library',
    {
      title: 'Create a new problem in the library',
      description:
        'Create a new problem in the Typelets problem library. The caller becomes the problem\'s owner. ' +
        'Returns the new problem including its id and slug. ' +
        'Errors: 409 if a problem with that slug already exists (choose a different slug).',
      inputSchema: {
        slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and dashes.').describe('URL-safe identifier, e.g. "two-sum". Must be unique across the library.'),
        title: z.string().trim().min(1).max(200).describe('Human-readable problem title, e.g. "Two Sum".'),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium').describe('Problem difficulty. Defaults to "medium".'),
        prompt: z.string().min(1).max(20000).describe('The problem statement shown to candidates. Markdown supported.'),
        rubric: z.string().max(20000).nullable().optional().describe('Interviewer-only scoring rubric. Not visible to candidates. Markdown supported.'),
        criteria: z.array(criterionSchema).max(20).default([]).describe('Structured scoring criteria (name + description pairs). Up to 20.'),
        tests: z.array(testCaseSchema).max(40).default([]).describe('Test cases: either stdin/expectedStdout or framework-exec. Up to 40.'),
        starters: z.record(z.string(), z.string()).default({}).describe('Legacy single-file starter map (filename → content). Prefer starterFiles for new problems.'),
        starterFiles: z.array(problemFileSchema).max(5000).default([]).describe('Starter file tree materialized into the workspace when the problem is applied. Up to 5000 files.'),
        solutionFiles: z.array(problemFileSchema).max(5000).default([]).describe('Reference solution files (interviewer-only, never shown to candidates). Up to 5000 files.'),
        testFiles: z.array(problemFileSchema).max(5000).default([]).describe('Test framework files materialized into the workspace alongside starter files. Up to 5000 files.'),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]).describe('Search tags, e.g. ["arrays", "hash-map"]. Up to 20, each max 40 chars.'),
        category: categoryEnum.default('other').describe('Problem category for filtering.'),
      },
    },
    async (input) => {
      try {
        const result = await client.post<SaveProblemResponse>('/problems', input);
        return ok(
          `Created problem "${result.problem.title}" (id=${result.problem.id}, slug=${result.problem.slug}).`,
          { problem: result.problem },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
