# Changelog

All notable changes to `@typelets/mcp` will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Scaffold + spec: README with the phased plan, PAT-based auth design, dual-profile (interviewer / candidate) approach, MIT license, GitHub Actions CI workflow.
- `src/env.ts` — parses `TYPELETS_TOKEN`, `TYPELETS_API_URL`, `TYPELETS_PROFILE` at start-up.
- `src/client.ts` — thin fetch wrapper around the Typelets API, with `TypeletsApiError` for non-2xx responses.
- `src/profile.ts` — strips `rubric`, `criteria`, hidden tests, and `solution` from problem responses when running under the candidate profile.
- `src/index.ts` — `McpServer` + stdio transport, registers the eight Phase 1 tools.
- Phase 1 tool surface:
  - `list_workspaces`
  - `get_workspace`
  - `list_workspace_files`
  - `read_workspace_file`
  - `list_problems`
  - `get_problem` — profile-aware
  - `list_recordings`
  - `list_pending_invites` — merges workspace + organisation invitations
- `tests/profile.test.ts`, `tests/client.test.ts` — node:test suites covering candidate-profile field stripping + fetch wrapper behaviour.

### Awaiting Typelets API

The following endpoints must land on https://typelets.com before `v0.1.0` can ship:

- Personal Access Token issuance UI + database table (`api_tokens`).
- Bearer-token auth on every existing route the MCP server calls (`/workspaces`, `/problems`, `/invites`, `/invitations`, etc.).
- `GET /workspaces/:id/files` — point-in-time materialised tree snapshot used by `list_workspace_files`.
- `GET /workspaces/:id/files/:fileId/content` — UTF-8 file content used by `read_workspace_file`.
