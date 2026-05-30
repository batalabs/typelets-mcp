/**
 * list_pending_invites — return invitations addressed to the caller.
 *
 * Returns both workspace-level and organization-level invites in the
 * same response so the LLM can answer "what's waiting for me?" with a
 * single tool call. Each entry carries an `accept` and `decline` path
 * the agent could plug into a Phase 2 write tool later.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { ok, fail } from './_shared.js';

interface WorkspaceInvite {
  kind: 'workspace';
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  createdAt: string;
}

interface OrgInvite {
  kind: 'organization';
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface ListInvitesResponse {
  invites: { id: string; workspaceId: string; workspaceName: string; role: string; createdAt: string }[];
}

interface ListOrgInvitationsResponse {
  invitations: { id: string; organization: { id: string; name: string }; role: string; createdAt: string; expiresAt: string }[];
}

export function registerListPendingInvites(
  server: McpServer,
  client: TypeletsClient,
  _env: Env,
): void {
  server.registerTool(
    'list_pending_invites',
    {
      title: 'List pending invitations',
      description:
        "Return every workspace + organisation invitation addressed to the caller's email. Combine the two server-side so the model sees one merged list.",
      inputSchema: {},
    },
    async () => {
      try {
        const [workspaceInvites, orgInvites] = await Promise.all([
          client.get<ListInvitesResponse>('/invites'),
          client.get<ListOrgInvitationsResponse>('/invitations'),
        ]);
        const merged: (WorkspaceInvite | OrgInvite)[] = [
          ...workspaceInvites.invites.map<WorkspaceInvite>((i) => ({
            kind: 'workspace',
            id: i.id,
            workspaceId: i.workspaceId,
            workspaceName: i.workspaceName,
            role: i.role,
            createdAt: i.createdAt,
          })),
          ...orgInvites.invitations.map<OrgInvite>((i) => ({
            kind: 'organization',
            id: i.id,
            organizationId: i.organization.id,
            organizationName: i.organization.name,
            role: i.role,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
          })),
        ];
        return ok(
          `Found ${merged.length} pending invitation${merged.length === 1 ? '' : 's'}.`,
          { invites: merged },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
