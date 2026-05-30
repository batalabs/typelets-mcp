/**
 * create_workspace — create a new Typelets workspace.
 *
 * Interviewer-only. Candidates never see this tool in listTools.
 * Returns the new workspace object including its id, which the
 * caller will need for subsequent tool calls (e.g. apply_problem_to_workspace).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface WorkspaceSummary {
  id: string;
  name: string;
  mode: string;
  shareScope: string;
}

interface CreateWorkspaceResponse {
  workspace: WorkspaceSummary;
}

export function registerCreateWorkspace(server: McpServer, client: TypeletsClient, env: Env): void {
  // Profile gate — keep the string in sync with INTERVIEWER_ONLY_TOOLS in ../profile.ts.
  if (!toolAllowedForProfile('create_workspace', env.profile)) return;

  server.registerTool(
    'create_workspace',
    {
      title: 'Create a new workspace',
      description:
        'Create a new Typelets workspace. Returns the new workspace object including its id. ' +
        'Use the returned id to apply a problem (apply_problem_to_workspace) or create files. ' +
        'Errors: 409 if mode=interview and shareScope=public (interviews cannot be public).',
      inputSchema: {
        name: z.string().min(1).max(80).describe('Display name for the new workspace (max 80 chars).'),
        mode: z.enum(['general', 'interview']).optional().describe('Workspace mode. Defaults to "general". Use "interview" for structured coding interviews.'),
        shareScope: z.enum(['private', 'org', 'public']).optional().describe('Sharing scope. Defaults to "private". "interview" mode cannot be "public".'),
      },
    },
    async ({ name, mode, shareScope }) => {
      try {
        const body: { name: string; mode?: string; shareScope?: string } = { name };
        if (mode !== undefined) body.mode = mode;
        if (shareScope !== undefined) body.shareScope = shareScope;
        const result = await client.post<CreateWorkspaceResponse>('/workspaces', body);
        return ok(`Created workspace "${result.workspace.name}" (id=${result.workspace.id}).`, { workspace: result.workspace });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
