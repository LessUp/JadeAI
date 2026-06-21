import assert from 'node:assert/strict';
import test from 'node:test';
import type { AIChatUIMessage } from '@/types/ai';
import {
  EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT,
  hasRenderableAssistantReplySinceRequest,
  isEmptyAssistantResponseErrorText,
  hasRenderableSerializedAssistantOutput,
  hasRenderableUIAssistantMessage,
  resolveAssistantTerminalOutcome,
  shouldSurfaceEmptyAssistantResponseError,
} from './chat-response-status';

test('hasRenderableSerializedAssistantOutput treats non-empty text as renderable', () => {
  assert.equal(hasRenderableSerializedAssistantOutput({
    content: '优化后的简历内容',
    orderedParts: [{ type: 'text', text: '优化后的简历内容' }],
  }), true);
});

test('hasRenderableSerializedAssistantOutput treats tool-only responses as renderable', () => {
  assert.equal(hasRenderableSerializedAssistantOutput({
    content: '',
    orderedParts: [{
      type: 'tool',
      toolName: 'updateResume',
      state: 'output-available',
      args: { section: 'experience' },
      result: { ok: true },
    }],
  }), true);
});

test('resolveAssistantTerminalOutcome marks empty terminal responses as stream errors', () => {
  const outcome = resolveAssistantTerminalOutcome({
    serialized: {
      content: '   ',
      orderedParts: [],
      hasError: false,
    },
    finishReason: 'stop',
    isAborted: false,
    classifiedErrorKind: undefined,
  });

  assert.equal(outcome.status, 'error');
  assert.equal(outcome.errorKind, 'stream');
  assert.equal(outcome.errorText, EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT);
});

test('resolveAssistantTerminalOutcome keeps classified errors', () => {
  const outcome = resolveAssistantTerminalOutcome({
    serialized: {
      content: '',
      orderedParts: [],
      hasError: false,
      errorText: 'Provider timeout',
    },
    finishReason: 'error',
    isAborted: false,
    classifiedErrorKind: 'provider',
  });

  assert.equal(outcome.status, 'error');
  assert.equal(outcome.errorKind, 'provider');
  assert.equal(outcome.errorText, 'Provider timeout');
});

test('isEmptyAssistantResponseErrorText matches only the canonical error text', () => {
  assert.equal(isEmptyAssistantResponseErrorText(EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT), true);
  assert.equal(isEmptyAssistantResponseErrorText('provider timeout'), false);
  assert.equal(isEmptyAssistantResponseErrorText(undefined), false);
});

test('shouldSurfaceEmptyAssistantResponseError requires explicit session-scoped terminal state', () => {
  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: undefined,
    terminalSessionId: undefined,
    requestStatus: 'ready',
    terminalStatus: undefined,
    hasRenderableAssistantReply: false,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: undefined,
    requestStatus: 'ready',
    terminalStatus: undefined,
    hasRenderableAssistantReply: false,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: 'session-b',
    requestStatus: 'ready',
    terminalStatus: undefined,
    hasRenderableAssistantReply: false,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: 'session-a',
    requestStatus: 'streaming',
    terminalStatus: undefined,
    hasRenderableAssistantReply: false,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: 'session-a',
    requestStatus: 'ready',
    terminalStatus: 'error',
    hasRenderableAssistantReply: false,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: 'session-a',
    requestStatus: 'ready',
    terminalStatus: undefined,
    hasRenderableAssistantReply: true,
  }), false);

  assert.equal(shouldSurfaceEmptyAssistantResponseError({
    sessionId: 'session-a',
    terminalSessionId: 'session-a',
    requestStatus: 'ready',
    terminalStatus: undefined,
    hasRenderableAssistantReply: false,
  }), true);
});

test('hasRenderableUIAssistantMessage detects renderable assistant parts', () => {
  const toolOnlyMessage = {
    id: 'assistant-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-updateResume',
        state: 'output-available',
        toolCallId: 'tool-1',
        input: { section: 'summary' },
        output: { success: true },
      },
    ],
  } as AIChatUIMessage;

  const emptyTextMessage = {
    id: 'assistant-2',
    role: 'assistant',
    parts: [{ type: 'text', text: '   ' }],
  } as AIChatUIMessage;

  assert.equal(hasRenderableUIAssistantMessage(toolOnlyMessage), true);
  assert.equal(hasRenderableUIAssistantMessage(emptyTextMessage), false);
});

test('hasRenderableAssistantReplySinceRequest treats same-id empty-to-renderable transition as new reply', () => {
  const latestAssistantMessage = {
    id: 'assistant-1',
    role: 'assistant',
    parts: [{ type: 'text', text: '已重新生成完整回复' }],
  } as AIChatUIMessage;

  assert.equal(
    hasRenderableAssistantReplySinceRequest(
      latestAssistantMessage,
      'assistant-1',
      false
    ),
    true
  );
});

test('hasRenderableAssistantReplySinceRequest rejects unchanged renderable baseline', () => {
  const latestAssistantMessage = {
    id: 'assistant-2',
    role: 'assistant',
    parts: [{ type: 'text', text: '原始回复' }],
  } as AIChatUIMessage;

  assert.equal(
    hasRenderableAssistantReplySinceRequest(
      latestAssistantMessage,
      'assistant-2',
      true
    ),
    false
  );
});
