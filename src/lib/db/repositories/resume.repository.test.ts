import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test, { after } from 'node:test';

import { DEFAULT_THEME } from '@/lib/resume-theme/default-theme';

const testDbPath = './data/resume-repository-integration.test.db';
const generatedDbFiles = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];

for (const file of generatedDbFiles) {
  rmSync(file, { force: true });
}

process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = testDbPath;
delete process.env.DATABASE_URL;

let closeDatabase: (() => Promise<void>) | undefined;

after(async () => {
  await closeDatabase?.();
  for (const file of generatedDbFiles) {
    rmSync(file, { force: true });
  }
});

test('create persists normalized themeConfig from the POST repository path', async () => {
  const [{ db, dbReady, adapter }, { users }, { resumeRepository }] = await Promise.all([
    import('../index'),
    import('../schema'),
    import('./resume.repository'),
  ]);
  closeDatabase = () => adapter.close();
  await dbReady;

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    authType: 'fingerprint',
    fingerprint: `theme-config-${userId}`,
  });

  const resume = await resumeRepository.create({
    userId,
    title: 'Imported resume',
    template: 'classic',
    language: 'en',
    themeConfig: {
      primaryColor: '#ABC',
      accentColor: '#bad-input',
      margin: { top: -10, right: 100 },
      sectionSpacing: 24,
    },
  });

  assert.ok(resume);
  assert.deepEqual(resume.themeConfig, {
    ...DEFAULT_THEME,
    primaryColor: '#aabbcc',
    accentColor: DEFAULT_THEME.accentColor,
    fontFamily: 'Inter, "Noto Sans SC", sans-serif',
    margin: {
      ...DEFAULT_THEME.margin,
      top: 0,
      right: 60,
    },
    sectionSpacing: 24,
  });
});

test('saveDraft syncs resume sections atomically and preserves ownership', async () => {
  const [{ db, dbReady }, { resumeRepository }, { users, resumes, resumeSections }] = await Promise.all([
    import('../index'),
    import('./resume.repository'),
    import('../schema'),
  ]);
  await dbReady;

  const ownerId = 'draft-owner';
  const otherUserId = 'draft-other-user';
  await db.insert(users).values([
    { id: ownerId, fingerprint: 'draft-owner-fingerprint', authType: 'fingerprint' },
    { id: otherUserId, fingerprint: 'draft-other-fingerprint', authType: 'fingerprint' },
  ]);

  await db.insert(resumes).values({
    id: 'draft-resume',
    userId: ownerId,
    title: 'Original resume',
    template: 'classic',
    language: 'zh',
  });
  await db.insert(resumeSections).values([
    {
      id: 'draft-keep',
      resumeId: 'draft-resume',
      type: 'summary',
      title: 'Summary',
      sortOrder: 0,
      visible: true,
      content: { text: 'old' },
    },
    {
      id: 'draft-remove',
      resumeId: 'draft-resume',
      type: 'skills',
      title: 'Skills',
      sortOrder: 1,
      visible: true,
      content: { categories: [] },
    },
  ]);

  const saved = await resumeRepository.saveDraft('draft-resume', {
    userId: ownerId,
    metadata: {
      title: 'Updated resume',
      themeConfig: { primaryColor: '#123456' },
    },
    sections: [
      {
        id: 'draft-keep',
        type: 'summary',
        title: 'Updated summary',
        sortOrder: 1,
        visible: false,
        content: { text: 'new' },
      },
      {
        id: 'draft-new',
        type: 'projects',
        title: 'Projects',
        sortOrder: 2,
        visible: true,
        content: { items: [] },
      },
    ],
  });

  assert.ok(saved);
  assert.equal(saved.title, 'Updated resume');
  assert.deepEqual(saved.themeConfig, { primaryColor: '#123456' });
  assert.deepEqual(
    saved.sections.map((section: { id: string }) => section.id),
    ['draft-keep', 'draft-new'],
  );
  assert.equal(saved.sections[0].title, 'Updated summary');
  assert.equal(saved.sections[0].visible, false);

  const denied = await resumeRepository.saveDraft('draft-resume', {
    userId: otherUserId,
    metadata: { title: 'Denied title' },
  });
  assert.equal(denied, null);
  assert.equal((await resumeRepository.findById('draft-resume'))?.title, 'Updated resume');

  await db.insert(resumes).values({
    id: 'rollback-resume',
    userId: ownerId,
    title: 'Rollback original',
    template: 'classic',
    language: 'zh',
  });
  await db.insert(resumeSections).values([
    {
      id: 'rollback-keep',
      resumeId: 'rollback-resume',
      type: 'summary',
      title: 'Rollback summary',
      sortOrder: 0,
      visible: true,
      content: { text: 'old' },
    },
    {
      id: 'rollback-remove',
      resumeId: 'rollback-resume',
      type: 'skills',
      title: 'Rollback skills',
      sortOrder: 1,
      visible: true,
      content: { categories: [] },
    },
  ]);

  await assert.rejects(
    resumeRepository.saveDraft('rollback-resume', {
      userId: ownerId,
      metadata: { title: 'Should roll back' },
      sections: [
        {
          id: 'rollback-keep',
          type: 'summary',
          title: 'Changed before failure',
          sortOrder: 0,
          visible: false,
          content: { text: 'changed' },
        },
        {
          id: 'rollback-invalid',
          type: null as unknown as string,
          title: 'Invalid section',
          sortOrder: 2,
          visible: true,
          content: {},
        },
      ],
    }),
    /constraint|not null/i,
  );

  const rolledBack = await resumeRepository.findById('rollback-resume');
  assert.ok(rolledBack);
  assert.equal(rolledBack.title, 'Rollback original');
  assert.deepEqual(
    rolledBack.sections.map((section: { id: string }) => section.id),
    ['rollback-keep', 'rollback-remove'],
  );
  assert.equal(rolledBack.sections[0].title, 'Rollback summary');
  assert.equal(rolledBack.sections[0].visible, true);
});
