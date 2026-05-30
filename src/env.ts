/**
 * Configuration the server reads from its process environment at start-up.
 * The MCP server is invoked by a client (Claude Desktop, Cline, etc.) which
 * supplies these via the client's mcpServers config, not by the user
 * directly — so a missing or malformed value should surface as a clear
 * stderr message before any tool registration happens.
 */
import { z } from 'zod';

/**
 * Personal Access Token issued at typelets.com/settings/tokens. Required.
 * Stored on disk only in the host client's MCP config; never leaves the
 * caller's machine.
 */
const tokenSchema = z.string().min(20, 'TYPELETS_TOKEN looks too short to be a real PAT.');

/**
 * API base URL. Defaults to production. Local development against a
 * self-hosted Typelets instance overrides this.
 */
const apiUrlSchema = z
  .string()
  .url()
  .default('https://api.typelets.com');

/**
 * Which tool surface to expose. `interviewer` (default) sees rubric +
 * hidden test content. `candidate` strips it out so an AI assistant
 * helping a candidate can not be fed the answer key. The profile is
 * fixed at start-up; the server refuses to switch it at runtime.
 */
const profileSchema = z.enum(['interviewer', 'candidate']).default('interviewer');

export interface Env {
  token: string;
  apiUrl: string;
  profile: 'interviewer' | 'candidate';
}

export function readEnv(): Env {
  const token = tokenSchema.parse(process.env.TYPELETS_TOKEN);
  const apiUrl = apiUrlSchema.parse(process.env.TYPELETS_API_URL);
  const profile = profileSchema.parse(process.env.TYPELETS_PROFILE);
  return { token, apiUrl, profile };
}
