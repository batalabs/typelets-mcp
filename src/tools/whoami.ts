/**
 * whoami: return the authenticated caller's identity. Wraps GET /auth/me so
 * the host LLM can confirm which account + profile it's operating as. Both
 * profiles.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface MeResponse {
  id: string;
  email?: string;
  displayName?: string | null;
  [k: string]: unknown;
}

export function registerWhoami(server: McpServer, client: TypeletsClient, env: Env): void {
  if (!toolAllowedForProfile('whoami', env.profile)) return;

  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'Return the authenticated caller identity (id, email, display name) for the PAT this server is using, plus the active profile. Use to confirm which account you are operating as.',
      inputSchema: {},
      annotations: { destructiveHint: false },
    },
    async () => {
      try {
        const me = await client.get<MeResponse>('/auth/me');
        const who = me.displayName ?? me.email ?? me.id;
        return ok(`Authenticated as ${who} (profile: ${env.profile}).`, {
          ...me,
          profile: env.profile,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
