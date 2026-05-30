/**
 * edit_problem — edit an existing library problem.
 *
 * Interviewer-only. All fields are optional — send only the ones you
 * want to change. Workspaces that previously applied the problem keep
 * their copy of the prompt/criteria/files; changes only affect future applies.
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

interface EditProblemResponse {
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
  name: z.string().trim().min(1).max(512).describe('Slash-separated path from workspace root.'),
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

export function registerEditProblem(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate — keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('edit_problem', env.profile)) return;

  server.registerTool(
    'edit_problem',
    {
      title: 'Edit an existing library problem',
      description:
        'Edit an existing problem in the Typelets library. All fields are optional — only the fields ' +
        'you provide are updated. Workspaces that previously applied this problem keep their copy of the ' +
        'prompt, criteria, and files; edits here only affect future apply_problem_to_workspace calls. ' +
        'Destructive — changes to the library entry are immediate and cannot be undone via this tool. ' +
        'Errors: 400 if no fields are provided; 403 if you are not the author (or not an org admin ' +
        'for shared-library problems); 404 if the problem is not found.',
      inputSchema: {
        problemId: z.string().min(1).describe('The problem id or slug from list_problems.'),
        title: z.string().trim().min(1).max(200).optional().describe('New title.'),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('New difficulty.'),
        prompt: z.string().min(1).max(20000).optional().describe('New problem statement. Markdown supported.'),
        rubric: z.string().max(20000).nullable().optional().describe('New interviewer-only rubric. Pass null to clear.'),
        criteria: z.array(criterionSchema).max(20).optional().describe('Replace the full criteria list. Up to 20 entries.'),
        tests: z.array(testCaseSchema).max(40).optional().describe('Replace the full test-case list. Up to 40 entries.'),
        starters: z.record(z.string(), z.string()).optional().describe('Replace the legacy single-file starter map.'),
        starterFiles: z.array(problemFileSchema).max(5000).optional().describe('Replace the full starter file tree. Up to 5000 files.'),
        solutionFiles: z.array(problemFileSchema).max(5000).optional().describe('Replace the full solution file tree. Up to 5000 files.'),
        testFiles: z.array(problemFileSchema).max(5000).optional().describe('Replace the full test file tree. Up to 5000 files.'),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().describe('Replace the tag list. Up to 20 tags.'),
        category: categoryEnum.optional().describe('New category.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ problemId, ...fields }) => {
      try {
        const result = await client.patch<EditProblemResponse>(
          `/problems/${encodeURIComponent(problemId)}`,
          fields,
        );
        return ok(
          `Updated problem "${result.problem.title}" (id=${result.problem.id}).`,
          { problem: result.problem },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
