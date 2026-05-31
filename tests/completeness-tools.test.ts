/**
 * Unit tests for the six Phase 2.2 completeness tools. Each is a thin wrapper
 * around a typelets-com endpoint. We verify: the right path + verb + body, and
 * profile gating (delete_workspace is interviewer-only; the rest are both).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { registerMovePath } from '../src/tools/move_path.ts';
import { registerCreateFolder } from '../src/tools/create_folder.ts';
import { registerDeleteFolder } from '../src/tools/delete_folder.ts';
import { registerAppendToFile } from '../src/tools/append_to_file.ts';
import { registerDeleteWorkspace } from '../src/tools/delete_workspace.ts';
import { registerWhoami } from '../src/tools/whoami.ts';
import type { TypeletsClient } from '../src/client.ts';
import type { Env } from '../src/env.ts';

interface Rec {
  name: string;
  handler: (i: unknown) => Promise<unknown>;
}
function fakeServer() {
  const registered: Rec[] = [];
  return {
    registered,
    registerTool: (name: string, _m: unknown, h: Rec['handler']) =>
      registered.push({ name, handler: h }),
  };
}
function fakeClient(impl: Partial<TypeletsClient> = {}): TypeletsClient {
  const no = async (): Promise<never> => {
    throw new Error('not impl');
  };
  return {
    get: impl.get ?? no,
    post: impl.post ?? no,
    put: impl.put ?? no,
    patch: impl.patch ?? no,
    delete: impl.delete ?? no,
  };
}
const interviewer: Env = { token: 't', apiUrl: 'https://api', profile: 'interviewer' };
const candidate: Env = { ...interviewer, profile: 'candidate' };

describe('move_path', () => {
  it('POSTs /workspaces/:id/move with nodeId + destinationPath', async () => {
    let path = '';
    let body: unknown;
    const c = fakeClient({
      post: async (p: string, b?: unknown) => {
        path = p;
        body = b;
        return { id: 'n1', path: 'lib/a.ts', type: 'file', parentId: 'f1' };
      },
    });
    const s = fakeServer();
    registerMovePath(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'move_path');
    assert.ok(t);
    await t!.handler({ workspaceId: 'w1', nodeId: 'n1', destinationPath: 'lib/a.ts' });
    assert.equal(path, '/workspaces/w1/files/move');
    assert.deepEqual(body, { nodeId: 'n1', destinationPath: 'lib/a.ts' });
  });
  it('registered for candidate', () => {
    const s = fakeServer();
    registerMovePath(s as never, fakeClient(), candidate);
    assert.ok(s.registered.find((r) => r.name === 'move_path'));
  });
});

describe('create_folder', () => {
  it('POSTs /workspaces/:id/folders with path', async () => {
    let path = '';
    let body: unknown;
    const c = fakeClient({
      post: async (p: string, b?: unknown) => {
        path = p;
        body = b;
        return { id: 'f1', path: 'lib', type: 'folder', parentId: null };
      },
    });
    const s = fakeServer();
    registerCreateFolder(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'create_folder');
    assert.ok(t);
    await t!.handler({ workspaceId: 'w1', path: 'lib' });
    assert.equal(path, '/workspaces/w1/folders');
    assert.deepEqual(body, { path: 'lib' });
  });
});

describe('delete_folder', () => {
  it('DELETEs /workspaces/:id/folders/:folderId', async () => {
    let path = '';
    const c = fakeClient({
      delete: async (p: string) => {
        path = p;
        return { deleted: 3 };
      },
    });
    const s = fakeServer();
    registerDeleteFolder(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'delete_folder');
    assert.ok(t);
    await t!.handler({ workspaceId: 'w1', folderId: 'f1' });
    assert.equal(path, '/workspaces/w1/folders/f1');
  });
});

describe('append_to_file', () => {
  it('PATCHes /workspaces/:id/files/:fileId/append with text', async () => {
    let path = '';
    let body: unknown;
    const c = fakeClient({
      patch: async (p: string, b?: unknown) => {
        path = p;
        body = b;
        return { id: 'fl1', bytes: 11 };
      },
    });
    const s = fakeServer();
    registerAppendToFile(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'append_to_file');
    assert.ok(t);
    await t!.handler({ workspaceId: 'w1', fileId: 'fl1', text: ' world' });
    assert.equal(path, '/workspaces/w1/files/fl1/append');
    assert.deepEqual(body, { text: ' world' });
  });
});

describe('delete_workspace', () => {
  it('DELETEs /workspaces/:id', async () => {
    let path = '';
    const c = fakeClient({
      delete: async (p: string) => {
        path = p;
        return undefined;
      },
    });
    const s = fakeServer();
    registerDeleteWorkspace(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'delete_workspace');
    assert.ok(t);
    await t!.handler({ workspaceId: 'w1' });
    assert.equal(path, '/workspaces/w1');
  });
  it('NOT registered for candidate', () => {
    const s = fakeServer();
    registerDeleteWorkspace(s as never, fakeClient(), candidate);
    assert.equal(s.registered.find((r) => r.name === 'delete_workspace'), undefined);
  });
});

describe('whoami', () => {
  it('GETs /auth/me', async () => {
    let path = '';
    const c = fakeClient({
      get: async (p: string) => {
        path = p;
        return { id: 'u1', displayName: 'Rui', email: 'r@x' };
      },
    });
    const s = fakeServer();
    registerWhoami(s as never, c, interviewer);
    const t = s.registered.find((r) => r.name === 'whoami');
    assert.ok(t);
    await t!.handler({});
    assert.equal(path, '/auth/me');
  });
});
