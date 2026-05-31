# typelets-mcp

A [Model Context Protocol](https://modelcontextprotocol.io/) server for [Typelets](https://typelets.com), the collaborative IDE for technical interviews and pair programming. Connect an MCP-capable client (Claude Desktop, Cline, Cursor, Codex, etc.) and let it list workspaces, browse the problem library, read candidate files, summarize sessions, and (later) write back to the workspace on your behalf.

Status: pre-alpha. The spec below is the plan; the server is being built in public.

## Why

Interviewers spend a lot of meta-work outside the coding window: authoring problems, prepping starter files, reviewing candidate code after the fact, summarizing what happened. Most of that work is "look at structured data, produce structured data," which is exactly what an LLM is good at. Wrapping the Typelets API as MCP tools lets the interviewer's AI of choice do that work without the platform itself needing to embed model logic.

## Phased plan

| Phase | Scope | Risk |
| --- | --- | --- |
| 1 | Read-only: list workspaces, list problems, get problem detail, read workspace tree + file contents, fetch recording metadata, list pending invites | Low. Nothing the LLM does here can change platform state. |
| 2 | Authoring: create workspace, apply problem to workspace, draft/edit a library problem, materialize starter files | Medium. Writes happen, but always against the caller's own resources. |
| 3 | Session intelligence: summarize a recording transcript, draft scores against the rubric, suggest follow-up questions, batch-import problems from a corpus | Higher. Outputs land on candidate-facing records, so there is a review gate before they take effect. |

Phase 1 is the entire v0.1.0 release. Phase 2 lands in v0.2.x. Phase 3 is v0.3.x once we have a UX answer for "review before commit".

## How auth works

The server authenticates against the Typelets API using a **Personal Access Token**. Tokens are issued in User Settings -> Tokens on https://typelets.com, are scoped per-user, and carry an expiry plus a label. Tokens never leave the user's machine. The MCP server reads `TYPELETS_TOKEN` from its environment, and the client passes it through.

Why not OAuth: this is a single-user CLI tool wired into a desktop LLM client. PATs match the audience without dragging in a browser dance every session. An OAuth flow becomes plausible later if a Typelets-hosted MCP gateway makes sense.

Why not session cookies: cookies are scoped to a browser and expire on the platform's schedule, not the user's. A PAT is the right primitive for "a programmable agent acting as me."

The PAT issuance flow is the only prerequisite work on the Typelets side. Everything else in this repo just wraps existing endpoints.

## Profiles

The server ships three profiles:

- **`interviewer`** (default): has access to rubric content, hidden tests, scores, and the full library.
- **`general`**: for using Typelets as a hosted dev/workspace product rather than for interviews. Full authoring — workspace lifecycle (create/delete), file/folder CRUD, and reads — but none of the interview tooling (no problem authoring, no recording analysis or rubric scoring). Any problem content it reads is stripped of rubric / criteria / hidden tests / solution.
- **`candidate`** (strict): hides rubric / hidden tests / scores even if the user's role would otherwise allow it, and additionally withholds workspace lifecycle + problem tooling. Useful when the user wants to point an AI assistant at their own in-progress interview without leaking the answer key into the LLM's context.

The profile is set at start-up, not per-tool:

```bash
TYPELETS_PROFILE=candidate npx @typelets/mcp
```

Default is `interviewer`. The server refuses to switch profiles at runtime. If you want more than one, run a server instance per profile.

## Install

```bash
npx @typelets/mcp
```

In your MCP client's config (Claude Desktop, Cline, Cursor, etc.):

```jsonc
{
  "mcpServers": {
    "typelets": {
      "command": "npx",
      "args": ["@typelets/mcp"],
      "env": {
        "TYPELETS_TOKEN": "pat_…",
        "TYPELETS_API_URL": "https://api.typelets.com",
        "TYPELETS_PROFILE": "interviewer"
      }
    }
  }
}
```

Get your token at https://typelets.com: User Settings → Tokens → New token. Give it a label like "Claude Desktop on laptop", pick an expiry, copy the value (you only see it once), and paste it into `TYPELETS_TOKEN`.

Profiles:
- `interviewer` (default): full surface, including rubric and hidden tests.
- `general`: workspace lifecycle + file/folder CRUD + reads; no interview tooling. Use this when you're using Typelets as a hosted dev/workspace product.
- `candidate`: file CRUD + reads only; rubric, criteria, hidden tests, and solution are stripped before they reach the LLM. Use this when you want an AI assistant helping you on a problem you're solving.

## Tool surface

In `general` profile the interview-authoring + session-intelligence tools are not registered; in `candidate` profile those plus workspace lifecycle (create/delete) are withheld. In each case the host LLM does not see the withheld tools in `listTools`.

### Reads (8 tools, both profiles)

| Tool | Reads | Notes |
| --- | --- | --- |
| `list_workspaces` | `GET /workspaces` | Caller's workspaces, with role + mode. |
| `get_workspace` | `GET /workspaces/:id` | Full summary, share scope, applied problem id. |
| `list_workspace_files` | `GET /workspaces/:id/files` | Flat list of file ids + slash-separated paths. |
| `read_workspace_file` | `GET /workspaces/:id/files/:fileId/content` | UTF-8 content at HEAD; 1 MiB cap with `truncated` flag. |
| `list_problems` | `GET /problems` | Library entries the caller can see. |
| `get_problem` | `GET /problems/:id` | Prompt + criteria. Rubric / hidden tests stripped in candidate profile. |
| `list_recordings` | `GET /workspaces/:id/recordings` | Metadata only. |
| `list_pending_invites` | `GET /invites` + `GET /invitations` | Merged workspace + org invites. |

### Writes: file CRUD (3 tools, both profiles)

| Tool | Writes | `destructive` |
| --- | --- | --- |
| `create_file` | `POST /workspaces/:id/files` | |
| `update_file` | `PUT /workspaces/:id/files/:fileId/content` | ✓ |
| `delete_file` | `DELETE /workspaces/:id/files/:fileId` | ✓ |

### Writes: authoring (5 tools, interviewer profile only)

| Tool | Writes | `destructive` |
| --- | --- | --- |
| `create_workspace` | `POST /workspaces` | |
| `apply_problem_to_workspace` | `POST /workspaces/:id/interview/problem` | ✓ |
| `save_problem_to_library` | `POST /problems` | |
| `edit_problem` | `PATCH /problems/:id` | ✓ |
| `delete_problem` | `DELETE /problems/:id` | ✓ |

Tools marked `destructive` carry the MCP `destructiveHint: true` annotation so host clients (Claude Desktop, Cline, Cursor) prompt the user before invocation.

### Session intelligence (3 tools, interviewer profile only)

| Tool | Reads | Input |
| --- | --- | --- |
| `summarize_recording` | `GET /workspaces/:id/recordings/:rid/timeline?mode=summary` | `workspaceId`, `recordingId` |
| `score_against_rubric` | `GET /workspaces/:id/recordings/:rid/timeline?mode=score` | `workspaceId`, `recordingId` |
| `suggest_followup_questions` | `GET /workspaces/:id/recordings/active/timeline` | `workspaceId` |

Each tool returns a structured timeline (per-file content checkpoints sampled across the session + chronological Run-button events) so the host LLM can write the prose summary, score, or follow-up questions itself. `score_against_rubric` also attaches the workspace's inline rubric + criteria; calls against a workspace with no applied problem return a friendly error pointing the user to `apply_problem_to_workspace`. `suggest_followup_questions` operates on the workspace's currently-active recording (last 5 minutes), and surfaces a clear error if no recording is in progress.

### Completeness: file/folder + lifecycle (6 tools)

| Tool | Writes | Profile | `destructive` |
| --- | --- | --- | --- |
| `move_path` | `POST /workspaces/:id/move` | both | |
| `create_folder` | `POST /workspaces/:id/folders` | both | |
| `delete_folder` | `DELETE /workspaces/:id/folders/:folderId` | both | ✓ |
| `append_to_file` | `PATCH /workspaces/:id/files/:fileId/append` | both | |
| `delete_workspace` | `DELETE /workspaces/:id` | interviewer only | ✓ |
| `whoami` | `GET /auth/me` | both | |

`move_path` renames or moves any node (file or folder) to a full destination path, creating intermediate folders as needed; it rejects moving a folder into its own subtree. `create_folder` makes an empty folder (idempotent). `delete_folder` removes a folder and everything under it. `append_to_file` adds to the end of a file without re-sending its content. `delete_workspace` is interviewer-only and owner-gated by the API. `whoami` reports the identity + profile the server is running as.

## Layout

```
typelets-mcp/
├─ README.md                  (this file)
├─ LICENSE
├─ package.json
├─ tsconfig.json
├─ .gitignore
├─ .github/
│  └─ workflows/
│     └─ ci.yml               (typecheck + lint + test on push)
├─ src/
│  ├─ index.ts                (server entry; wires stdio transport + handlers)
│  ├─ env.ts                  (parses TYPELETS_TOKEN / API_URL / PROFILE)
│  ├─ client.ts               (thin fetch wrapper around the Typelets API)
│  ├─ profile.ts              (interviewer vs candidate gating)
│  └─ tools/
│     ├─ list_workspaces.ts
│     ├─ get_workspace.ts
│     ├─ list_workspace_files.ts
│     ├─ read_workspace_file.ts
│     ├─ list_problems.ts
│     ├─ get_problem.ts
│     ├─ list_recordings.ts
│     └─ list_pending_invites.ts
└─ tests/                     (unit tests + recorded API fixtures)
```

## Contributing

Once v0.1.0 ships and the PAT flow is live on https://typelets.com, the repo will be open to issues + PRs. For now, watch the milestones tab.

## License

MIT. See [LICENSE](./LICENSE).
