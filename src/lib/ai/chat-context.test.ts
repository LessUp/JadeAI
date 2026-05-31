import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';

import { buildChatContextMessages } from './chat-context';
import { dbMessagesToUIMessages } from './utils';

function createConversation(pattern: string): UIMessage[] {
  const messages: UIMessage[] = [];

  for (let index = 0; index < pattern.length; index += 1) {
    const turn = index + 1;

    messages.push({
      id: `user-${turn}`,
      role: 'user',
      parts: [{ type: 'text', text: `user ${turn}` }],
    });

    if (pattern[index] === 'T') {
      messages.push({
        id: `assistant-${turn}`,
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-updateSection',
            toolCallId: `assistant-${turn}-tool-0`,
            state: 'output-available',
            input: { sectionId: `section-${turn}` },
            output: { success: true },
          },
          { type: 'step-start' },
          { type: 'text', text: `assistant ${turn}` },
        ],
      });
      continue;
    }

    messages.push({
      id: `assistant-${turn}`,
      role: 'assistant',
      parts: [{ type: 'text', text: `assistant ${turn}` }],
    });
  }

  return messages;
}

test('chat context truncation does not start with a tool result', async () => {
  const messages = createConversation('TTTNNNNNNNN');

  const modelMessages = await buildChatContextMessages(messages);

  assert.notEqual(modelMessages[0]?.role, 'tool');

  for (let index = 0; index < modelMessages.length; index += 1) {
    const message = modelMessages[index];
    if (message?.role !== 'tool' || typeof message.content === 'string') continue;

    const previous = modelMessages[index - 1];
    if (!previous || previous.role !== 'assistant' || typeof previous.content === 'string') {
      assert.fail('tool result should stay paired with the preceding assistant tool call');
    }

    const previousToolCallIds = new Set(
      previous.content
        .filter((part) => part.type === 'tool-call')
        .map((part) => part.toolCallId)
        .filter((toolCallId): toolCallId is string => Boolean(toolCallId))
    );

    for (const part of message.content) {
      if (part.type !== 'tool-result') continue;
      assert.ok(previousToolCallIds.has(part.toolCallId));
    }
  }
});

test('resumed history keeps tool calls and trailing text in separate assistant steps', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          { type: 'step-start' },
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          { type: 'step-start' },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const modelMessages = await buildChatContextMessages(resumedMessages);

  for (let index = 0; index < modelMessages.length; index += 1) {
    const message = modelMessages[index];
    if (message?.role !== 'assistant' || typeof message.content === 'string') continue;

    const types = message.content.map((part) => part.type);
    assert.ok(!(types.includes('tool-call') && types.includes('text')));

    if (!types.includes('tool-call')) continue;

    const nextMessage = modelMessages[index + 1];
    assert.equal(nextMessage?.role, 'tool');
  }
});

test('legacy orderedParts history regains missing step boundaries', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  assert.deepEqual(
    assistantMessage?.parts.map((part) => part.type),
    ['step-start', 'tool-updateSection', 'step-start', 'text']
  );

  const modelMessages = await buildChatContextMessages(resumedMessages);

  assert.equal(modelMessages[1]?.role, 'assistant');
  assert.equal(modelMessages[2]?.role, 'tool');
  assert.equal(modelMessages[3]?.role, 'assistant');
});

test('legacy orderedParts with repeated tool steps stay provider-valid', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'experience' },
            result: { success: true },
          },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  assert.deepEqual(
    assistantMessage?.parts.map((part) => part.type),
    ['step-start', 'tool-updateSection', 'step-start', 'tool-updateSection', 'step-start', 'text']
  );

  const modelMessages = await buildChatContextMessages(resumedMessages);

  assert.equal(modelMessages[1]?.role, 'assistant');
  assert.equal(modelMessages[2]?.role, 'tool');
  assert.equal(modelMessages[3]?.role, 'assistant');
  assert.equal(modelMessages[4]?.role, 'tool');
  assert.equal(modelMessages[5]?.role, 'assistant');
});

test('legacy toolCalls history uses documented old tool format', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        toolCalls: [{ tool: 'updateSection', args: { sectionId: 'summary' }, applied: false }],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  assert.deepEqual(
    assistantMessage?.parts.map((part) => part.type),
    ['step-start', 'tool-updateSection', 'step-start', 'text']
  );
  assert.deepEqual((assistantMessage?.parts[1] as { output?: unknown }).output, { applied: false });

  const modelMessages = await buildChatContextMessages(resumedMessages);

  assert.equal(modelMessages[1]?.role, 'assistant');
  assert.equal(modelMessages[2]?.role, 'tool');
  assert.equal(modelMessages[3]?.role, 'assistant');
});

test('resumed history preserves tool error state instead of fabricating success', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'error',
        errorText: 'Tool request timed out',
        orderedParts: [
          { type: 'step-start' },
          {
            type: 'tool',
            toolName: 'translateResume',
            state: 'output-error',
            args: { targetLanguage: 'en' },
            errorText: 'Tool request timed out',
          },
        ],
      },
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[0] as UIMessage & {
    metadata?: { status?: string; errorText?: string };
  };
  const toolPart = assistantMessage.parts[1] as {
    state?: string;
    errorText?: string;
    output?: unknown;
  };

  assert.equal(assistantMessage.metadata?.status, 'error');
  assert.equal(assistantMessage.metadata?.errorText, 'Tool request timed out');
  assert.equal(toolPart.state, 'output-error');
  assert.equal(toolPart.errorText, 'Tool request timed out');
  assert.equal(toolPart.output, undefined);
});

test('resumed pending assistant metadata survives even without text parts', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'submitted',
        startedAt: 1234567890,
        orderedParts: [],
      },
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[0] as UIMessage & {
    metadata?: { status?: string; startedAt?: number };
  };

  assert.equal(assistantMessage.metadata?.status, 'submitted');
  assert.equal(assistantMessage.metadata?.startedAt, 1234567890);
  assert.deepEqual(assistantMessage.parts, []);
});
