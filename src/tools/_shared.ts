/**
 * Helpers shared across tool handlers.
 *
 * The MCP tool response shape is `{ content: ContentItem[], isError?: boolean }`.
 * Every Phase 1 tool returns the same structure:
 *   - a `text` block carrying a short human-readable summary
 *   - a `text` block carrying the JSON payload, fenced so the host LLM
 *     can pick it out cleanly
 *
 * Keeping the shape uniform means downstream LLMs can rely on the
 * "first line is summary, fenced block is data" contract without
 * tool-specific parsing.
 */
import { TypeletsApiError } from '../client.js';

export interface ToolContentItem {
  type: 'text';
  text: string;
}

export interface ToolResult {
  // Index signature is required by the MCP SDK's tool callback return
  // type. Keeps the shape extensible without losing the named fields.
  [x: string]: unknown;
  content: ToolContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/** Build a successful tool response. `summary` is human-readable; `data`
 *  is the structured payload the model should reason over. */
export function ok(summary: string, data: unknown): ToolResult {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: `\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` },
    ],
    structuredContent: { result: data },
  };
}

/** Build an error tool response. Maps TypeletsApiError to a readable
 *  message and preserves the underlying status so the model can branch
 *  on it (e.g. 404 -> ask the user for a different id). */
export function fail(err: unknown): ToolResult {
  if (err instanceof TypeletsApiError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Typelets API error ${err.status}: ${err.message}`,
        },
      ],
      structuredContent: { error: { status: err.status, message: err.message } },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: 'text', text: `tool failed: ${message}` }],
    structuredContent: { error: { message } },
  };
}
