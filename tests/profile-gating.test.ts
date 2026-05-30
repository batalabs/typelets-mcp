/**
 * Unit tests for registration-time profile gating.
 *
 * Verifies that `toolAllowedForProfile` correctly gates tool registration
 * so interviewer-only tools are never visible to a candidate profile.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { toolAllowedForProfile } from '../src/profile.ts';

describe('toolAllowedForProfile', () => {
  it('allows every tool in interviewer profile', () => {
    for (const name of ['create_workspace', 'apply_problem_to_workspace', 'create_file', 'update_file', 'delete_file', 'save_problem_to_library', 'edit_problem', 'delete_problem']) {
      assert.equal(toolAllowedForProfile(name, 'interviewer'), true);
    }
  });

  it('blocks interviewer-only tools in candidate profile', () => {
    for (const name of ['create_workspace', 'apply_problem_to_workspace', 'save_problem_to_library', 'edit_problem', 'delete_problem']) {
      assert.equal(toolAllowedForProfile(name, 'candidate'), false);
    }
  });

  it('allows per-file tools in candidate profile', () => {
    for (const name of ['create_file', 'update_file', 'delete_file']) {
      assert.equal(toolAllowedForProfile(name, 'candidate'), true);
    }
  });

  it('does not affect Phase 1 read tools in either profile', () => {
    for (const name of ['list_workspaces', 'get_workspace', 'read_workspace_file', 'list_problems', 'get_problem', 'list_recordings', 'list_pending_invites', 'list_workspace_files']) {
      assert.equal(toolAllowedForProfile(name, 'interviewer'), true);
      assert.equal(toolAllowedForProfile(name, 'candidate'), true);
    }
  });
});
