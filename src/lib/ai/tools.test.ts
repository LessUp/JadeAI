import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';

import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const TEST_AI_CONFIG = {
  provider: 'openai',
  apiKey: 'test-api-key',
  baseURL: 'https://example.com/v1',
  model: 'gpt-4o-mini',
} as const;

type ModuleLoader = {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

test('updateSection can rename section title with field="title"', async (t) => {
  const originalFindByIdForUser = resumeRepository.findByIdForUser;
  const originalUpdateSection = resumeRepository.updateSection;
  const moduleLoader = Module as unknown as ModuleLoader;
  const originalModuleLoad = moduleLoader._load;

  const updates: Array<{
    id: string;
    data: Partial<{ title: string; sortOrder: number; visible: boolean; content: unknown }>;
  }> = [];

  resumeRepository.findByIdForUser = async () =>
    ({
      sections: [
        {
          id: 'custom-section-1',
          type: 'custom',
          title: '旧标题',
          content: {
            items: [{ id: 'item-1', title: '条目标题', description: '条目描述' }],
          },
        },
      ],
    }) as Awaited<ReturnType<typeof resumeRepository.findByIdForUser>>;

  resumeRepository.updateSection = async (id, data) => {
    updates.push({ id, data });
  };

  t.after(() => {
    moduleLoader._load = originalModuleLoad;
    resumeRepository.findByIdForUser = originalFindByIdForUser;
    resumeRepository.updateSection = originalUpdateSection;
  });

  moduleLoader._load = (request, parent, isMain) => {
    if (request === 'server-only') return {};
    return originalModuleLoad(request, parent, isMain);
  };

  const { createExecutableTools } = await import('./tools');
  const tools = createExecutableTools({
    resumeId: 'resume-1',
    aiConfig: TEST_AI_CONFIG,
    userId: 'user-1',
  });
  const updateSectionTool = tools.updateSection as {
    execute?: (input: { sectionId: string; field: string; value: string }) => Promise<{ success: boolean }>;
  };
  assert.ok(updateSectionTool.execute);

  const result = await updateSectionTool.execute({
    sectionId: 'custom-section-1',
    field: 'title',
    value: '技术关键字',
  });

  assert.equal(result.success, true);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    id: 'custom-section-1',
    data: { title: '技术关键字' },
  });
});

test('updateSection can rename section title with field="sectionTitle"', async (t) => {
  const originalFindByIdForUser = resumeRepository.findByIdForUser;
  const originalUpdateSection = resumeRepository.updateSection;
  const moduleLoader = Module as unknown as ModuleLoader;
  const originalModuleLoad = moduleLoader._load;

  const updates: Array<{
    id: string;
    data: Partial<{ title: string; sortOrder: number; visible: boolean; content: unknown }>;
  }> = [];

  resumeRepository.findByIdForUser = async () =>
    ({
      sections: [
        {
          id: 'custom-section-2',
          type: 'custom',
          title: 'Original',
          content: {
            items: [{ id: 'item-2', title: 'Item', description: 'desc' }],
          },
        },
      ],
    }) as Awaited<ReturnType<typeof resumeRepository.findByIdForUser>>;

  resumeRepository.updateSection = async (id, data) => {
    updates.push({ id, data });
  };

  t.after(() => {
    moduleLoader._load = originalModuleLoad;
    resumeRepository.findByIdForUser = originalFindByIdForUser;
    resumeRepository.updateSection = originalUpdateSection;
  });

  moduleLoader._load = (request, parent, isMain) => {
    if (request === 'server-only') return {};
    return originalModuleLoad(request, parent, isMain);
  };

  const { createExecutableTools } = await import('./tools');
  const tools = createExecutableTools({
    resumeId: 'resume-1',
    aiConfig: TEST_AI_CONFIG,
    userId: 'user-1',
  });
  const updateSectionTool = tools.updateSection as {
    execute?: (input: { sectionId: string; field: string; value: string }) => Promise<{ success: boolean }>;
  };
  assert.ok(updateSectionTool.execute);

  const result = await updateSectionTool.execute({
    sectionId: 'custom-section-2',
    field: 'sectionTitle',
    value: 'Technical Keywords',
  });

  assert.equal(result.success, true);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    id: 'custom-section-2',
    data: { title: 'Technical Keywords' },
  });
});
