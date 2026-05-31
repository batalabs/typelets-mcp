/**
 * upload_file: upload a binary file (image/asset) into a workspace.
 *
 * MCP is a text transport, so the bytes arrive base64-encoded and are decoded
 * here before being POSTed to the binary endpoint. Unlike create_file (which
 * stores UTF-8 text in the Yjs doc), this stores raw bytes in object storage,
 * which is how a persistent general workspace hosts images/assets served at
 * its preview URL or custom domain.
 *
 * Available to every profile, same as the other file-CRUD tools: the API
 * enforces workspace membership + role. It is not interview tooling, so it is
 * not withheld from the candidate or general profiles.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TypeletsClient } from '../client.js';
import type { Env } from '../env.js';
import { toolAllowedForProfile } from '../profile.js';
import { ok, fail } from './_shared.js';

interface UploadFileResponse {
  id: string;
  path: string;
  type: 'file';
  parentId: string | null;
  mimeType: string;
  sizeBytes: number;
  binary: true;
}

/** Best-effort mime type from a path extension; the server re-validates. */
const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  zip: 'application/zip',
  wasm: 'application/wasm',
};

function mimeFor(path: string, explicit?: string): string {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function registerUploadFile(
  server: McpServer,
  client: TypeletsClient,
  env: Env,
): void {
  // Profile gate: keep the string in sync with profile.ts.
  if (!toolAllowedForProfile('upload_file', env.profile)) return;

  server.registerTool(
    'upload_file',
    {
      title: 'Upload a binary file to a workspace',
      description:
        'Upload a binary file (image, font, PDF, or other asset) to a slash-separated path in a workspace. The content must be base64-encoded; intermediate folders are created as needed. Use create_file for UTF-8 text. On a persistent workspace the uploaded asset is served at its preview URL / custom domain. Errors: 409 if a file already exists at the path; 413 if the file exceeds 25 MiB.',
      inputSchema: {
        workspaceId: z.string().min(1).describe('The workspace id from list_workspaces.'),
        path: z
          .string()
          .min(1)
          .describe('Slash-separated path from the workspace root (e.g. "assets/logo.png"). Cannot contain ".." segments.'),
        contentBase64: z.string().min(1).describe('The file bytes, base64-encoded.'),
        mimeType: z
          .string()
          .optional()
          .describe('MIME type, e.g. "image/png". Inferred from the path extension when omitted.'),
      },
    },
    async ({ workspaceId, path, contentBase64, mimeType }) => {
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(Buffer.from(contentBase64, 'base64'));
      } catch {
        return fail(new Error('contentBase64 is not valid base64.'));
      }
      if (bytes.length === 0) {
        return fail(new Error('Decoded content is empty.'));
      }
      try {
        const result = await client.uploadBinary<UploadFileResponse>(
          workspaceId,
          path,
          bytes,
          mimeFor(path, mimeType),
        );
        return ok(
          `Uploaded ${result.path} (id=${result.id}, ${result.mimeType}, ${result.sizeBytes} bytes).`,
          { file: result },
        );
      } catch (err) {
        return fail(err);
      }
    },
  );
}
