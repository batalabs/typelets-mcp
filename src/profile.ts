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
 * Interview-specific tools: authoring problems, plus the session-intelligence
 * tools that read a recorded interview (summaries, rubric scoring, follow-up
 * suggestions). These only make sense for an interviewer running a hiring
 * loop, so both the `candidate` and `general` profiles skip registering them.
 *
 * `general` is the profile for someone using Typelets as a hosted
 * dev/workspace product rather than for interviews: they get full authoring
 * (workspace lifecycle + file/folder CRUD + reads) but none of the
 * interview machinery.
 */
const INTERVIEW_TOOLS: ReadonlySet<string> = new Set([
  'apply_problem_to_workspace',
  'save_problem_to_library',
  'edit_problem',
  'duplicate_problem',
  'delete_problem',
  'summarize_recording',
  'score_against_rubric',
  'suggest_followup_questions',
]);

/**
 * Workspace lifecycle tools. An interviewer or a general (product) user can
 * create and delete their own workspaces; a candidate works only inside the
 * interview workspace they were invited to, so these are withheld from the
 * candidate profile.
 */
const WORKSPACE_LIFECYCLE_TOOLS: ReadonlySet<string> = new Set([
  'create_workspace',
  'delete_workspace',
]);

/**
 * Names of tools the candidate profile MUST NOT register: every
 * interview-authoring/intelligence tool plus workspace lifecycle. The
 * server skips registration for these when `env.profile === 'candidate'`,
 * so the candidate's host LLM never sees them in `listTools`.
 *
 * Kept as a named export for the existing gating tests and any callers that
 * relied on it; it is the union of the two sets above.
 *
 * Per-file CRUD (create_file, update_file, delete_file) is allowed for
 * candidates: they have editor role inside their own interview workspace
 * and need to be able to modify their files.
 */
export const INTERVIEWER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  ...WORKSPACE_LIFECYCLE_TOOLS,
  ...INTERVIEW_TOOLS,
]);

export function toolAllowedForProfile(toolName: string, profile: Env['profile']): boolean {
  if (profile === 'interviewer') return true;
  // general: full authoring (workspace lifecycle + file CRUD + reads) but no
  // interview tooling.
  if (profile === 'general') return !INTERVIEW_TOOLS.has(toolName);
  // candidate: no interview tooling and no workspace lifecycle.
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
