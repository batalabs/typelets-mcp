# typelets-mcp

A [Model Context Protocol](https://modelcontextprotocol.io/) server for [Typelets](https://typelets.com), the collaborative IDE for technical interviews and pair programming. Connect an MCP-capable client (Claude Desktop, Cline, Cursor, Codex, etc.) and let it list workspaces, browse the problem library, read candidate files, summarize sessions, and (later) write back to the workspace on your behalf.

Status: pre-alpha. The spec below is the plan; the server is being built in public.

## Why

Interviewers spend a lot of meta-work outside the coding window: authoring problems, prepping starter files, reviewing candidate code after the fact, summarizing what happened. Most of that work is "look at structured data, produce structured data" — exactly what an LLM is good at. Wrapping the Typelets API as MCP tools lets the interviewer's AI of choice do that work without the platform itself needing to embed model logic.

## Phased plan

| Phase | Scope | Risk |
| --- | --- | --- |
| 1 | Read-only: list workspaces, list problems, get problem detail, read workspace tree + file contents, fetch recording metadata, list pending invites | Low. Nothing the LLM does here can change platform state. |
| 2 | Authoring: create workspace, apply problem to workspace, draft/edit a library problem, materialize starter files | Medium. Writes happen, but always against the caller's own resources. |
| 3 | Session intelligence: summarize a recording transcript, draft scores against the rubric, suggest follow-up questions, batch-import problems from a corpus | Higher. Outputs land on candidate-facing records, so there is a review gate before they take effect. |

Phase 1 is the entire v0.1.0 release. Phase 2 lands in v0.2.x. Phase 3 is v0.3.x once we have a UX answer for "review before commit".

## How auth works

The server authenticates against the Typelets API using a **Personal Access Token**. Tokens are issued in User Settings -> Tokens on https://typelets.com, are scoped per-user, and carry an expiry plus a label. Tokens never leave the user's machine — the MCP server reads `TYPELETS_TOKEN` from its environment, and the client passes it through.

Why not OAuth: this is a single-user CLI tool wired into a desktop LLM client. PATs match the audience without dragging in a browser dance every session. An OAuth flow becomes plausible later if a Typelets-hosted MCP gateway makes sense.

Why not session cookies: cookies are scoped to a browser and expire on the platform's schedule, not the user's. A PAT is the right primitive for "a programmable agent acting as me."

The PAT issuance flow is the only prerequisite work on the Typelets side. Everything else in this repo just wraps existing endpoints.

## Two profiles

The server ships two profiles:

- **`interviewer`** — default. Has access to rubric content, hidden tests, scores, and the full library.
- **`candidate`** — strict. Hides rubric / hidden tests / scores even if the user's role would otherwise allow it. Useful when the user wants to point an AI assistant at their own in-progress interview without leaking the answer key into the LLM's context.

The profile is set at start-up, not per-tool:

```bash
TYPELETS_PROFILE=candidate npx @typelets/mcp
```

Default is `interviewer`. The server refuses to switch profiles at runtime — if you want both, run two server instances on different ports.

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

Get your token at https://typelets.com — User Settings → Tokens → New token. Give it a label like "Claude Desktop on laptop", pick an expiry, copy the value (you only see it once), and paste it into `TYPELETS_TOKEN`.

Profiles:
- `interviewer` (default) — full surface, including rubric and hidden tests.
- `candidate` — the same tools but rubric, criteria, hidden tests, and solution are stripped before they reach the LLM. Use this when you want an AI assistant helping you on a problem you're solving.

## Phase 1 tool surface

The intended tools for v0.1.0 — names and arguments are still subject to change while the SDK shape settles.

| Tool | Reads | Notes |
| --- | --- | --- |
| `list_workspaces` | `GET /workspaces` | Returns the caller's workspaces, with role and mode. |
| `get_workspace` | `GET /workspaces/:id` | Full summary, including share scope and applied problem id. |
| `list_workspace_files` | tree snapshot | Walks the workspace tree and returns paths + ids. |
| `read_workspace_file` | file snapshot | Returns the file contents at HEAD. UTF-8 only. |
| `list_problems` | `GET /problems` | Library entries the caller can see. Respects profile. |
| `get_problem` | `GET /problems/:id` | Prompt + criteria. Rubric / tests only in interviewer profile. |
| `list_recordings` | `GET /workspaces/:id/recordings` | Metadata only; the actual blob endpoints stay out of scope for v0.1.0. |
| `list_pending_invites` | `GET /invites` | The caller's pending workspace + org invites. |

Each tool returns structured JSON for the model and a short prose summary for the human reading the chat transcript.

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
