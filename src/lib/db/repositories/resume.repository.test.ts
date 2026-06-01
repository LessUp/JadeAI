import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test, { after } from 'node:test';

import { DEFAULT_THEME } from '@/lib/resume-theme/default-theme';

const testDbPath = './data/resume-repository-theme.test.db';
const generatedDbFiles = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];

for (const file of generatedDbFiles) {
  rmSync(file, { force: true });
}

process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = testDbPath;

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

test('replaceDraftForUser keeps resume metadata and sections unchanged when any write in the transaction fails', async () => {
  const [{ db, dbReady }, { users }, { resumeRepository }] = await Promise.all([
    import('../index'),
    import('../schema'),
    import('./resume.repository'),
  ]);
  await dbReady;

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    authType: 'fingerprint',
    fingerprint: `transaction-rollback-${userId}`,
  });

  const resume = await resumeRepository.create({
    userId,
    title: 'Before rollback',
    template: 'classic',
    language: 'en',
  });
  assert.ok(resume);

  const sectionAId = crypto.randomUUID();
  const sectionBId = crypto.randomUUID();
  await resumeRepository.createSection({
    id: sectionAId,
    resumeId: resume.id,
    type: 'summary',
    title: 'Summary',
    sortOrder: 0,
    visible: true,
    content: { text: 'before-summary' },
  });
  await resumeRepository.createSection({
    id: sectionBId,
    resumeId: resume.id,
    type: 'skills',
    title: 'Skills',
    sortOrder: 1,
    visible: true,
    content: { categories: [{ id: crypto.randomUUID(), name: 'Core', skills: ['TypeScript'] }] },
  });

  const duplicateSectionId = crypto.randomUUID();
  await assert.rejects(
    resumeRepository.replaceDraftForUser({
      id: resume.id,
      userId,
      title: 'Should rollback',
      sections: [
        {
          id: sectionAId,
          type: 'summary',
          title: 'Summary updated',
          sortOrder: 0,
          visible: true,
          content: { text: 'after-summary' },
        },
        {
          id: duplicateSectionId,
          type: 'custom',
          title: 'New section #1',
          sortOrder: 1,
          visible: true,
          content: { items: [] },
        },
        {
          id: duplicateSectionId,
          type: 'custom',
          title: 'New section #2',
          sortOrder: 2,
          visible: true,
          content: { items: [] },
        },
      ],
    }),
  );

  const after = await resumeRepository.findById(resume.id);
  assert.ok(after);
  assert.equal(after.title, 'Before rollback');

  const summarySection = after.sections.find((section: any) => section.id === sectionAId);
  const skillsSection = after.sections.find((section: any) => section.id === sectionBId);
  assert.ok(summarySection);
  assert.ok(skillsSection);
  assert.equal(after.sections.length, 2);
  assert.deepEqual(summarySection.content, { text: 'before-summary' });
  assert.deepEqual(skillsSection.content, {
    categories: [
      {
        id: (skillsSection.content as any).categories[0].id,
        name: 'Core',
        skills: ['TypeScript'],
      },
    ],
  });
});
