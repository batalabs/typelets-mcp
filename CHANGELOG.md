# Changelog

All notable changes to `@typelets/mcp` will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-30

### Added

- Profile gating at registration time. Interviewer-only tools are no longer registered when `TYPELETS_PROFILE=candidate`; the host LLM never sees them in `listTools`.
- Eight write tools:
  - `create_workspace` (interviewer)
  - `apply_problem_to_workspace` (interviewer, destructive)
  - `create_file` (both)
  - `update_file` (both, destructive)
  - `delete_file` (both, destructive)
  - `save_problem_to_library` (interviewer)
  - `edit_problem` (interviewer, destructive)
  - `delete_problem` (interviewer, destructive)
- All destructive tools carry the MCP `destructiveHint: true` annotation so host clients prompt the user before invocation.
- `fail()` shared helper now surfaces validation `details` from 4xx responses so the LLM can self-correct on schema errors.
- `TypeletsClient` gains a `put` method for `update_file`.

### Notes

- `update_file` replaces file contents wholesale. A co-editor currently editing the file via y-websocket will have their cursor snap to position 0; their in-flight edits are NOT preserved. Documented in the tool description.
- No native undo. Writes are immediate and irreversible from the MCP server's perspective. The Yjs document history exists in the y-websocket server's persistence but is not exposed via API.

## [0.1.0] - 2026-05-30

### Added
- Scaffold + spec: README with the phased plan, PAT-based auth design, dual-profile (interviewer / candidate) approach, MIT license, GitHub Actions CI workflow.
- `src/env.ts`: parses `TYPELETS_TOKEN`, `TYPELETS_API_URL`, `TYPELETS_PROFILE` at start-up.
- `src/client.ts`: thin fetch wrapper around the Typelets API, with `TypeletsApiError` for non-2xx responses.
- `src/profile.ts`: strips `rubric`, `criteria`, hidden tests, and `solution` from problem responses when running under the candidate profile.
- `src/index.ts`: `McpServer` + stdio transport, registers the eight Phase 1 tools.
- Phase 1 tool surface:
  - `list_workspaces`
  - `get_workspace`
  - `list_workspace_files`
  - `read_workspace_file`
  - `list_problems`
  - `get_problem` (profile-aware)
  - `list_recordings`
  - `list_pending_invites` (merges workspace + organisation invitations)
- `tests/profile.test.ts`, `tests/client.test.ts`: node:test suites covering candidate-profile field stripping + fetch wrapper behaviour.
