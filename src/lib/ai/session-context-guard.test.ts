import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';

import {
  selectLatestResumeBaselineMessages,
  shouldRebaseChatContextToLatestResume,
} from './session-context-guard';

function createMessage(id: string, role: UIMessage['role'], text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

test('rebases context when resume was updated after the chat session', () => {
  const sessionUpdatedAt = '2026-06-01T10:00:00.000Z';
  const resumeUpdatedAt = '2026-06-01T10:00:00.100Z';

  assert.equal(
    shouldRebaseChatContextToLatestResume(sessionUpdatedAt, resumeUpdatedAt),
    true
  );
});

test('does not rebase context when session is up to date', () => {
  const sessionUpdatedAt = '2026-06-01T10:00:00.100Z';
  const resumeUpdatedAt = '2026-06-01T10:00:00.000Z';

  assert.equal(
    shouldRebaseChatContextToLatestResume(sessionUpdatedAt, resumeUpdatedAt),
    false
  );
});

test('does not rebase when updatedAt timestamps are unavailable', () => {
  assert.equal(shouldRebaseChatContextToLatestResume(null, '2026-06-01T10:00:00.000Z'), false);
  assert.equal(shouldRebaseChatContextToLatestResume('2026-06-01T10:00:00.000Z', undefined), false);
});

test('keeps recent conversation turns for rebase context', () => {
  const messages: UIMessage[] = [
    createMessage('user-1', 'user', 'request 1'),
    createMessage('assistant-1', 'assistant', 'response 1'),
    createMessage('user-2', 'user', 'request 2'),
    createMessage('assistant-2', 'assistant', 'response 2'),
    createMessage('user-3', 'user', 'request 3'),
    createMessage('assistant-3', 'assistant', 'response 3'),
    createMessage('user-4', 'user', 'request 4'),
    createMessage('assistant-4', 'assistant', 'response 4'),
  ];

  const selected = selectLatestResumeBaselineMessages(messages);

  assert.deepEqual(
    selected.map((message) => message.id),
    ['user-2', 'assistant-2', 'user-3', 'assistant-3', 'user-4', 'assistant-4']
  );
});

test('keeps recent messages when there is no user message', () => {
  const messages: UIMessage[] = [
    createMessage('assistant-1', 'assistant', 'first'),
    createMessage('assistant-2', 'assistant', 'second'),
  ];

  const selected = selectLatestResumeBaselineMessages(messages);

  assert.deepEqual(
    selected.map((message) => message.id),
    ['assistant-1', 'assistant-2']
  );
});
