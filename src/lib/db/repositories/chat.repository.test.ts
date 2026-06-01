import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test, { after } from 'node:test';

const testDbPath = './data/chat-repository-pagination.test.db';
const generatedDbFiles = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];

for (const file of generatedDbFiles) {
  rmSync(file, { force: true });
}

process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = testDbPath;

let closeDatabase: (() => Promise<void>) | undefined;
type PaginatedMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string };

after(async () => {
  await closeDatabase?.();
  for (const file of generatedDbFiles) {
    rmSync(file, { force: true });
  }
});

async function createSessionFixture(prefix: string) {
  const [{ db, dbReady, adapter }, { users, resumes, chatSessions }] = await Promise.all([
    import('../index'),
    import('../schema'),
  ]);
  closeDatabase = () => adapter.close();
  await dbReady;

  const userId = `${prefix}-user`;
  const resumeId = `${prefix}-resume`;
  const sessionId = `${prefix}-session`;
  await db.insert(users).values({
    id: userId,
    authType: 'fingerprint',
    fingerprint: `${prefix}-fingerprint`,
  });
  await db.insert(resumes).values({
    id: resumeId,
    userId,
    title: `${prefix}-resume`,
    template: 'classic',
    language: 'en',
  });
  await db.insert(chatSessions).values({
    id: sessionId,
    resumeId,
    title: `${prefix}-session`,
  });

  return { db, sessionId };
}

test('findPaginatedMessages does not drop same-second messages across pages', async () => {
  const [{ chatRepository }, { chatMessages }] = await Promise.all([
    import('./chat.repository'),
    import('../schema'),
  ]);
  const { db, sessionId } = await createSessionFixture(`same-second-${crypto.randomUUID()}`);
  const sharedCreatedAt = new Date('2026-01-01T00:00:00.000Z');

  await db.insert(chatMessages).values([
    { id: 'msg-001', sessionId, role: 'user', content: 'Q1', metadata: {}, createdAt: sharedCreatedAt },
    { id: 'msg-002', sessionId, role: 'assistant', content: 'A1', metadata: {}, createdAt: sharedCreatedAt },
    { id: 'msg-003', sessionId, role: 'user', content: 'Q2', metadata: {}, createdAt: sharedCreatedAt },
    { id: 'msg-004', sessionId, role: 'assistant', content: 'A2', metadata: {}, createdAt: sharedCreatedAt },
    { id: 'msg-005', sessionId, role: 'user', content: 'Q3', metadata: {}, createdAt: sharedCreatedAt },
    { id: 'msg-006', sessionId, role: 'assistant', content: 'A3', metadata: {}, createdAt: sharedCreatedAt },
  ]);

  const collectedIds: string[] = [];
  const collectedUserContents: string[] = [];
  let cursor: string | undefined;
  let guard = 0;

  do {
    const page = await chatRepository.findPaginatedMessages(sessionId, { limit: 2, cursor });
    const pageMessages = page.messages as PaginatedMessage[];
    if (guard === 0) {
      assert.ok(page.nextCursor?.includes('|'));
    }
    collectedIds.push(...pageMessages.map((message) => message.id));
    collectedUserContents.push(
      ...pageMessages
        .filter((message) => message.role === 'user')
        .map((message) => message.content),
    );
    cursor = page.nextCursor;
    guard += 1;
  } while (cursor && guard < 10);

  assert.equal(guard, 3);
  assert.equal(collectedIds.length, 6);
  assert.deepEqual([...new Set(collectedIds)].sort(), ['msg-001', 'msg-002', 'msg-003', 'msg-004', 'msg-005', 'msg-006']);
  assert.deepEqual([...new Set(collectedUserContents)].sort(), ['Q1', 'Q2', 'Q3']);
});

test('findPaginatedMessages accepts legacy timestamp-only cursor', async () => {
  const [{ chatRepository }, { chatMessages }] = await Promise.all([
    import('./chat.repository'),
    import('../schema'),
  ]);
  const { db, sessionId } = await createSessionFixture(`legacy-cursor-${crypto.randomUUID()}`);

  const olderCreatedAt = new Date('2026-01-01T00:00:00.000Z');
  const newerCreatedAt = new Date('2026-01-01T00:00:01.000Z');

  await db.insert(chatMessages).values([
    { id: 'legacy-001', sessionId, role: 'user', content: 'Older question', metadata: {}, createdAt: olderCreatedAt },
    { id: 'legacy-002', sessionId, role: 'assistant', content: 'Older answer', metadata: {}, createdAt: olderCreatedAt },
    { id: 'legacy-003', sessionId, role: 'user', content: 'Newer question', metadata: {}, createdAt: newerCreatedAt },
    { id: 'legacy-004', sessionId, role: 'assistant', content: 'Newer answer', metadata: {}, createdAt: newerCreatedAt },
  ]);

  const page = await chatRepository.findPaginatedMessages(sessionId, {
    limit: 10,
    cursor: newerCreatedAt.toISOString(),
  });

  assert.deepEqual((page.messages as PaginatedMessage[]).map((message) => message.id), ['legacy-001', 'legacy-002']);
  assert.equal(page.hasMore, false);
});
