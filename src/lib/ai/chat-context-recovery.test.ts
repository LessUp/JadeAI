import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import { stripAssistantToolPartsForRecovery } from './chat-context-recovery';

test('stripAssistantToolPartsForRecovery keeps assistant text but removes tool parts', () => {
  const messages: UIMessage[] = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        {
          type: 'tool-updateSection',
          toolCallId: 'assistant-1-tool-0',
          state: 'output-available',
          input: { sectionId: 'summary' },
          output: { success: true },
        },
        { type: 'text', text: '已完成更新' },
      ],
    },
  ];

  const recovered = stripAssistantToolPartsForRecovery(messages);
  assert.deepEqual(recovered[0]?.parts, [{ type: 'text', text: '已完成更新' }]);
});

test('stripAssistantToolPartsForRecovery leaves non-assistant messages unchanged', () => {
  const messages: UIMessage[] = [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '继续优化' }],
    },
  ];

  const recovered = stripAssistantToolPartsForRecovery(messages);
  assert.deepEqual(recovered, messages);
});
