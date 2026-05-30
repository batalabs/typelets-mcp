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
 * The Phase 1 tool surface is read-only on purpose so v0.1.0 ships
 * without needing a confirmation UX. Phase 2 (writes) and Phase 3
 * (session intelligence) land in subsequent minor releases.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readEnv } from './env.js';
import { createClient } from './client.js';

async function main(): Promise<void> {
  const env = readEnv();
  const _client = createClient(env);

  const server = new Server(
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

  // Phase 1 tool registration lands as individual src/tools/*.ts files
  // each exporting register(server, client, env). Keeping the registration
  // out of this file means the entry stays small and the tool surface
  // can grow without re-touching main().
  // TODO(phase-1): import and call register() for:
  //   - list_workspaces
  //   - get_workspace
  //   - list_workspace_files
  //   - read_workspace_file
  //   - list_problems
  //   - get_problem
  //   - list_recordings
  //   - list_pending_invites

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
