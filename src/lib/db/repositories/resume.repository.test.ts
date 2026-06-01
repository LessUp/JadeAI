import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('saveDraft syncs resume sections atomically and preserves ownership', async () => {
  const testDbDir = join(process.cwd(), '.test-output', `resume-repository-${process.pid}-${Date.now()}`);
  const testDbPath = join(testDbDir, 'jade.db');
  mkdirSync(testDbDir, { recursive: true });

  process.env.DB_TYPE = 'sqlite';
  process.env.SQLITE_PATH = testDbPath;
  delete process.env.DATABASE_URL;

  const [{ adapter, db, dbReady }, { resumeRepository }, { users, resumes, resumeSections }] = await Promise.all([
    import('../index'),
    import('./resume.repository'),
    import('../schema'),
  ]);

  try {
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
  } finally {
    await adapter.close();
    rmSync(testDbDir, { recursive: true, force: true });
  }
});
