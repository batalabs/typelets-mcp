/**
 * Profile-aware filtering for outbound tool responses.
 *
 * The `candidate` profile strips fields the candidate must not see even
 * if their auth token would let them: hidden tests, rubric content,
 * scores, solution files. The `interviewer` profile is a pass-through.
 *
 * The point is defense in depth. The API already enforces these
 * boundaries on a per-role basis, but the candidate profile is a
 * second gate the user opts into when they don't want their AI
 * assistant ingesting answer-key content along with the prompt.
 */
import type { Env } from './env.js';

export interface ProblemDetailLike {
  id: string;
  title: string;
  prompt: string;
  difficulty: string;
  category: string;
  tags: string[];
  /** Interviewer-only. Removed in candidate profile. */
  rubric?: string | null;
  /** Interviewer-only. Removed in candidate profile. */
  criteria?: { name: string; description: string }[];
  /** Interviewer-only. Hidden tests stripped; visible tests remain. */
  tests?: { input: string; expectedOutput: string; visible: boolean }[];
  starters?: Record<string, unknown>;
  /** Interviewer-only. Removed entirely in candidate profile. */
  solution?: Record<string, unknown>;
}

/**
 * Names of tools that the candidate profile MUST NOT register. The
 * server skips registration for these when `env.profile === 'candidate'`,
 * so the candidate's host LLM never sees them in `listTools` and cannot
 * try to invoke them.
 *
 * Per-file CRUD (create_file, update_file, delete_file) is allowed for
 * candidates: they have editor role inside their own interview
 * workspace and need to be able to modify their files.
 */
export const INTERVIEWER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'create_workspace',
  'apply_problem_to_workspace',
  'save_problem_to_library',
  'edit_problem',
  'delete_problem',
  'summarize_recording',
  'score_against_rubric',
  'suggest_followup_questions',
]);

export function toolAllowedForProfile(toolName: string, profile: Env['profile']): boolean {
  if (profile === 'interviewer') return true;
  return !INTERVIEWER_ONLY_TOOLS.has(toolName);
}

export function filterProblemForProfile<T extends ProblemDetailLike>(
  problem: T,
  env: Env,
): T {
  if (env.profile === 'interviewer') return problem;
  const next = { ...problem };
  delete next.rubric;
  delete next.criteria;
  delete next.solution;
  if (Array.isArray(next.tests)) {
    next.tests = next.tests.filter((t) => t.visible === true);
  }
  return next;
}
