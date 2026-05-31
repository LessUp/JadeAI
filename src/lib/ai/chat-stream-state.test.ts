import assert from 'node:assert/strict';
import test from 'node:test';

import type { AIChatUIMessage } from '@/types/ai';
import {
  countCompletedToolParts,
  getNextToolResultReloadState,
  isCompletedToolPart,
} from './chat-stream-state';

function assistantWithTool(state: string): AIChatUIMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [{
      type: 'tool-updateSection',
      toolCallId: crypto.randomUUID(),
      state,
      input: {},
      output: {},
    } as AIChatUIMessage['parts'][number]],
  };
}

test('detects only completed AI tool output parts', () => {
  assert.equal(isCompletedToolPart({ type: 'tool-updateSection', state: 'output-available' }), true);
  assert.equal(isCompletedToolPart({ type: 'tool-updateSection', state: 'input-available' }), false);
  assert.equal(isCompletedToolPart({ type: 'text', text: 'hello' }), false);
});

test('counts completed assistant tool outputs across messages', () => {
  assert.equal(countCompletedToolParts([
    assistantWithTool('output-available'),
    assistantWithTool('input-available'),
    { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
  ]), 1);
});

test('reload state ignores tool results already present in initial history', () => {
  const initialMessages = [assistantWithTool('output-available')];
  const initialCount = countCompletedToolParts(initialMessages);

  assert.deepEqual(getNextToolResultReloadState(initialCount, initialMessages), {
    shouldReload: false,
    completedToolCount: 1,
  });
});

test('reload state triggers exactly when a new tool output appears', () => {
  const previousMessages = [assistantWithTool('output-available')];
  const nextMessages = [...previousMessages, assistantWithTool('output-available')];

  assert.deepEqual(getNextToolResultReloadState(1, nextMessages), {
    shouldReload: true,
    completedToolCount: 2,
  });
});
