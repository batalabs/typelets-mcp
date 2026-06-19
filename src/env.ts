/**
 * Configuration the server reads from its process environment at start-up.
 * The MCP server is invoked by a client (Claude Desktop, Cline, etc.) which
 * supplies these via the client's mcpServers config, not by the user
 * directly, so a missing or malformed value should surface as a clear
 * stderr message before any tool registration happens.
 */
import { z } from 'zod';

/**
 * Personal Access Token issued at app.typelets.com/settings/tokens. Required.
 * Stored on disk only in the host client's MCP config; never leaves the
 * caller's machine.
 */
const tokenSchema = z.string().min(20, 'TYPELETS_TOKEN looks too short to be a real PAT.');

/**
 * API base URL. Defaults to production. Local development against a
 * self-hosted Typelets instance overrides this.
 */
// The production API is served at app.typelets.com/api. NOT api.typelets.com
// (does not resolve) and NOT typelets.com/api (that is the marketing site since
// the app cutover). A Cloudflare rule lets authenticated (Bearer) API requests
// past Super Bot Fight Mode. Local dev overrides this via TYPELETS_API_URL.
const apiUrlSchema = z.string().url().default('https://app.typelets.com/api');

/**
 * Which tool surface to expose:
 *  - `interviewer` (default): full surface; sees rubric + hidden test content.
 *  - `candidate`: strips answer-key content and withholds workspace lifecycle
 *    + interview-authoring tools, so an AI assistant helping a candidate can
 *    not be fed the answer key or reshape the interview.
 *  - `general`: for using Typelets as a hosted dev/workspace product rather
 *    than for interviews — full authoring (workspace lifecycle + file/folder
 *    CRUD + reads) but none of the interview machinery.
 * The profile is fixed at start-up; the server refuses to switch it at runtime.
 */
const profileSchema = z
  .enum(['interviewer', 'candidate', 'general'])
  .default('interviewer');

export interface Env {
  token: string;
  apiUrl: string;
  profile: 'interviewer' | 'candidate' | 'general';
}

export function readEnv(): Env {
  const token = tokenSchema.parse(process.env.TYPELETS_TOKEN);
  const apiUrl = apiUrlSchema.parse(process.env.TYPELETS_API_URL);
  const profile = profileSchema.parse(process.env.TYPELETS_PROFILE);
  return { token, apiUrl, profile };
}
