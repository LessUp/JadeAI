import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelListPayload, readModelListResponse } from './model-list';

test('normalizeModelListPayload accepts provider objects and string models', () => {
  assert.deepEqual(normalizeModelListPayload({ models: [{ id: 'gpt-5' }, 'claude-sonnet'] }), {
    models: [{ id: 'gpt-5' }, { id: 'claude-sonnet' }],
  });
});

test('readModelListResponse preserves recoverable server errors', async () => {
  const response = new Response(JSON.stringify({ models: [], error: 'upstream auth failed' }), { status: 400 });

  assert.deepEqual(await readModelListResponse(response, 'Unable to load models'), {
    models: [],
    error: 'upstream auth failed',
  });
});

test('readModelListResponse supplies a fallback error for non-JSON failures', async () => {
  const response = new Response('bad gateway', { status: 502 });

  assert.deepEqual(await readModelListResponse(response, 'Unable to load models'), {
    models: [],
    error: 'Unable to load models (502)',
  });
});
