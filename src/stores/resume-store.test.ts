import assert from 'node:assert/strict';
import test from 'node:test';
import type { Resume } from '@/types/resume';
import { useResumeStore } from './resume-store';
import { useSettingsStore } from './settings-store';

function createResume(overrides: Partial<Resume> = {}): Resume {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'resume-1',
    userId: 'user-1',
    title: 'Original title',
    template: 'classic',
    themeConfig: {
      primaryColor: '#000000',
      accentColor: '#111111',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      lineSpacing: 1.6,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 16,
      avatarStyle: 'circle',
    },
    isDefault: false,
    language: 'en',
    createdAt: now,
    updatedAt: now,
    sections: [
      {
        id: 'section-1',
        resumeId: 'resume-1',
        type: 'summary',
        title: 'Summary',
        sortOrder: 0,
        visible: true,
        content: { text: 'Original summary' },
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

function resetStores() {
  useSettingsStore.setState({
    autoSave: false,
    autoSaveInterval: 500,
    _hydrated: true,
  });
  useResumeStore.getState().reset();
}

test('save syncs resume updatedAt and section timestamps from server response when no local edits race in', async (t) => {
  resetStores();

  const original = createResume();
  useResumeStore.getState().setResume(original);
  useResumeStore.setState({ isDirty: true });

  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    resetStores();
  });
  console.error = () => {};

  const serverUpdatedAt = '2026-01-02T00:00:00.000Z';
  const sectionUpdatedAt = '2026-01-02T01:23:45.000Z';
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ...original,
        updatedAt: serverUpdatedAt,
        sections: [
          {
            ...original.sections[0],
            updatedAt: sectionUpdatedAt,
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  await useResumeStore.getState().save({ source: 'autosave' });

  const state = useResumeStore.getState();
  assert.equal(state.isDirty, false);
  assert.ok(state.currentResume);
  assert.equal(state.currentResume.updatedAt.toISOString(), serverUpdatedAt);
  assert.equal(state.sections[0].id, 'section-1');
  assert.equal(state.sections[0].updatedAt.toISOString(), sectionUpdatedAt);
});

test('save keeps dirty state when local draft changes while request is in flight', async (t) => {
  resetStores();

  const original = createResume();
  useResumeStore.getState().setResume(original);
  useResumeStore.setState({ isDirty: true });

  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    resetStores();
  });
  console.error = () => {};

  const responseResolvers: Array<(value: Response) => void> = [];
  globalThis.fetch = async () =>
    await new Promise<Response>((resolve) => {
      responseResolvers.push(resolve);
    });

  const pendingSave = useResumeStore.getState().save({ source: 'autosave' });

  useResumeStore.setState((state) => {
    if (!state.currentResume) return state;
    const sections = state.sections.map((section) =>
      section.id === 'section-1'
        ? {
            ...section,
            content: { text: 'Edited while saving' },
          }
        : section
    );
    return {
      sections,
      currentResume: {
        ...state.currentResume,
        title: 'Edited while saving',
        sections,
      },
      isDirty: true,
    };
  });

  const resolveResponse = responseResolvers[0];
  if (!resolveResponse) {
    throw new Error('Expected autosave request to be in flight');
  }
  resolveResponse(
    new Response(
      JSON.stringify({
        ...original,
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );

  await pendingSave;

  const state = useResumeStore.getState();
  assert.ok(state.currentResume);
  assert.equal(state.currentResume.title, 'Edited while saving');
  assert.equal(state.currentResume.updatedAt.toISOString(), '2026-01-03T00:00:00.000Z');
  assert.deepEqual(state.sections[0].content, { text: 'Edited while saving' });
  assert.equal(state.isDirty, true);
});
