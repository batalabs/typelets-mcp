#!/usr/bin/env node
/**
 * Entry point for the Typelets MCP server.
 *
 * Runs over stdio (the transport every desktop MCP client speaks today).
 * On start-up we:
 *   1. Read + validate the env (token, api url, profile).
 *   2. Build a thin API client.
 *   3. Register the Phase 1 read-only tools.
 *   4. Hand off to the MCP SDK's stdio transport loop.
 *
 * Phase 1 is read-only on purpose so v0.1.0 ships without needing a
 * confirmation UX. Phase 2 (writes) and Phase 3 (session intelligence)
 * land in later minor releases.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readEnv } from './env.js';
import { createClient } from './client.js';
import { registerListWorkspaces } from './tools/list_workspaces.js';
import { registerGetWorkspace } from './tools/get_workspace.js';
import { registerListWorkspaceFiles } from './tools/list_workspace_files.js';
import { registerReadWorkspaceFile } from './tools/read_workspace_file.js';
import { registerListProblems } from './tools/list_problems.js';
import { registerGetProblem } from './tools/get_problem.js';
import { registerListRecordings } from './tools/list_recordings.js';
import { registerListPendingInvites } from './tools/list_pending_invites.js';
import { registerCreateFile } from './tools/create_file.js';
import { registerUpdateFile } from './tools/update_file.js';
import { registerDeleteFile } from './tools/delete_file.js';
import { registerCreateWorkspace } from './tools/create_workspace.js';
import { registerApplyProblemToWorkspace } from './tools/apply_problem_to_workspace.js';
import { registerSaveProblemToLibrary } from './tools/save_problem_to_library.js';
import { registerEditProblem } from './tools/edit_problem.js';
import { registerDeleteProblem } from './tools/delete_problem.js';

async function main(): Promise<void> {
  const env = readEnv();
  const client = createClient(env);

  const server = new McpServer(
    {
      name: 'typelets-mcp',
      version: '0.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Phase 1 read-only tools. Each module owns its own input schema,
  // description, and handler so adding/removing tools is a single-file
  // change and the entry stays a flat registration list.
  registerListWorkspaces(server, client, env);
  registerGetWorkspace(server, client, env);
  registerListWorkspaceFiles(server, client, env);
  registerReadWorkspaceFile(server, client, env);
  registerListProblems(server, client, env);
  registerGetProblem(server, client, env);
  registerListRecordings(server, client, env);
  registerListPendingInvites(server, client, env);

  // Phase 2 write tools (profile-gated inside each register function).
  registerCreateFile(server, client, env);
  registerUpdateFile(server, client, env);
  registerDeleteFile(server, client, env);
  registerCreateWorkspace(server, client, env);
  registerApplyProblemToWorkspace(server, client, env);
  registerSaveProblemToLibrary(server, client, env);
  registerEditProblem(server, client, env);
  registerDeleteProblem(server, client, env);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is the MCP transport). Surfaces in the client's
  // server log so the user can confirm the profile they're running.
  process.stderr.write(
    `typelets-mcp running. profile=${env.profile} api=${env.apiUrl}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(
    `typelets-mcp failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
