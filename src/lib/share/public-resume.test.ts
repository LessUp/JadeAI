import test from 'node:test';
import assert from 'node:assert/strict';
import { serializePublicResume } from './public-resume';
import { DEFAULT_THEME } from '@/lib/resume-theme/default-theme';

test('serializePublicResume exposes only the public resume shape', () => {
  const serialized = serializePublicResume({
    id: 'resume-1',
    userId: 'user-1',
    title: 'Public Resume',
    template: 'classic',
    themeConfig: DEFAULT_THEME,
    isDefault: true,
    language: 'en',
    shareToken: 'secret-token',
    isPublic: true,
    sharePassword: 'hashed-share-password',
    password: 'future-sensitive-password',
    viewCount: 42,
    internalMetadata: { audit: true },
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-02T00:00:00.000Z'),
    sections: [
      {
        id: 'section-1',
        resumeId: 'resume-1',
        type: 'summary',
        title: 'Summary',
        sortOrder: 0,
        visible: true,
        content: { text: 'Hello world' },
        password: 'section-password',
        metadata: { internal: true },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      },
    ],
  } as any);

  assert.deepEqual(serialized, {
    id: 'resume-1',
    title: 'Public Resume',
    template: 'classic',
    themeConfig: DEFAULT_THEME,
    language: 'en',
    sections: [
      {
        id: 'section-1',
        type: 'summary',
        title: 'Summary',
        sortOrder: 0,
        visible: true,
        content: { text: 'Hello world' },
      },
    ],
  });
});

test('serializePublicResume defaults missing sections to an empty list', () => {
  assert.deepEqual(
    serializePublicResume({
      id: 'resume-1',
      title: 'Public Resume',
      template: 'classic',
      themeConfig: DEFAULT_THEME,
      language: 'en',
    }),
    {
      id: 'resume-1',
      title: 'Public Resume',
      template: 'classic',
      themeConfig: DEFAULT_THEME,
      language: 'en',
      sections: [],
    },
  );
});
