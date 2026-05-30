/**
 * Unit tests for the candidate-profile content stripping.
 *
 * The defense-in-depth promise here is "an LLM in candidate profile
 * never sees rubric / criteria / hidden tests / solution, regardless
 * of what the API returned." That's worth a real test rather than an
 * eyeball check. The field set will grow over time.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { filterProblemForProfile } from '../src/profile.ts';
import type { Env } from '../src/env.ts';

const FULL = {
  id: 'p1',
  title: 'Two Sum',
  prompt: 'Given an array of integers…',
  difficulty: 'easy',
  category: 'arrays_strings',
  tags: ['array', 'hash'],
  rubric: 'O(n) preferred',
  criteria: [{ name: 'Correctness', description: 'Passes all tests' }],
  tests: [
    { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', visible: true },
    { input: '[3,3]\n6', expectedOutput: '[0,1]', visible: false },
  ],
  starters: { python: '# starter\n' },
  solution: { python: 'def twoSum(nums, target):\n    ...' },
};

describe('filterProblemForProfile', () => {
  it('passes through unchanged in interviewer profile', () => {
    const env: Env = { token: 't', apiUrl: 'x', profile: 'interviewer' };
    const out = filterProblemForProfile(FULL, env);
    assert.deepEqual(out, FULL);
  });

  it('strips rubric, criteria, solution in candidate profile', () => {
    const env: Env = { token: 't', apiUrl: 'x', profile: 'candidate' };
    const out = filterProblemForProfile(FULL, env);
    assert.equal(out.rubric, undefined);
    assert.equal(out.criteria, undefined);
    assert.equal(out.solution, undefined);
  });

  it('keeps visible tests and drops hidden tests in candidate profile', () => {
    const env: Env = { token: 't', apiUrl: 'x', profile: 'candidate' };
    const out = filterProblemForProfile(FULL, env);
    assert.equal(out.tests?.length, 1);
    assert.equal(out.tests?.[0]?.visible, true);
  });

  it('preserves prompt + starters in candidate profile', () => {
    const env: Env = { token: 't', apiUrl: 'x', profile: 'candidate' };
    const out = filterProblemForProfile(FULL, env);
    assert.equal(out.prompt, FULL.prompt);
    assert.deepEqual(out.starters, FULL.starters);
  });
});
