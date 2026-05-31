'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResumeStore } from '@/stores/resume-store';
import { useSettingsStore, getAIHeaders } from '@/stores/settings-store';
import { generateId } from '@/lib/utils';
import type { AIChatStatus, AIChatUIMessage } from '@/types/ai';
import {
  saveCurrentResumeVersion,
  syncResumeFromServer,
} from '@/lib/editor/resume-history-actions';
import { countCompletedToolParts, getNextToolResultReloadState } from '@/lib/ai/chat-stream-state';

interface UseAIChatOptions {
  resumeId: string;
  sessionId?: string;
  initialMessages?: AIChatUIMessage[];
  selectedModel?: string;
}

export interface AIStreamActivity {
  startedAt?: number;
  firstTokenAt?: number;
  lastTokenAt?: number;
  hasReceivedToken?: boolean;
}

function getMessageText(message?: AIChatUIMessage) {
  if (!message?.parts) return '';
  return message.parts
    .filter((part): part is { type: 'text'; text: string } =>
      part.type === 'text' && 'text' in part && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');
}

function getLatestAssistantText(messages: AIChatUIMessage[]) {
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  return getMessageText(latestAssistantMessage);
}

export function useAIChat({ resumeId, sessionId, initialMessages, selectedModel }: UseAIChatOptions) {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<AIChatUIMessage[]>([]);
  const [lastTerminalStatus, setLastTerminalStatus] = useState<AIChatStatus | undefined>();
  const [terminalSessionId, setTerminalSessionId] = useState<string | undefined>();
  const [streamStartedAt, setStreamStartedAt] = useState<number | undefined>();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        body: () => ({ resumeId, model: selectedModel, sessionId }),
        // headers must be a function — useChat never updates the transport ref,
        // so a static object would freeze stale values from before store hydration.
        headers: () => {
          const fp = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
          return { ...(fp ? { 'x-fingerprint': fp } : {}), ...getAIHeaders() };
        },
      }),
    [resumeId, selectedModel, sessionId]
  );

  const { messages, sendMessage, status, error, setMessages, stop, clearError } = useChat<AIChatUIMessage>({
    id: sessionId,
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const terminalStatus = terminalSessionId === sessionId
    ? lastTerminalStatus || (status === 'error' ? 'error' : status === 'ready' && terminalSessionId ? 'completed' : undefined)
    : undefined;

  // Track completed tool call count to detect new tool results
  const completedToolCountRef = useRef(0);

  const startStreamActivity = useCallback(() => {
    setStreamStartedAt(Date.now());
  }, []);

  const resetStreamActivity = useCallback(() => {
    setStreamStartedAt(undefined);
  }, []);

  const sendChatMessage = useCallback(
    (...args: Parameters<typeof sendMessage>) => {
      startStreamActivity();
      return sendMessage(...args);
    },
    [sendMessage, startStreamActivity]
  );

  const reloadResume = useCallback(async () => {
    if (!resumeId) return;
    try {
      const store = useResumeStore.getState();
      // Cancel any pending autosave to prevent overwriting server data
      if (store._saveTimeout) clearTimeout(store._saveTimeout);

      if (store.currentResume) {
        await saveCurrentResumeVersion('checkpoint');
      }

      const fp = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
      const res = await fetch(`/api/resume/${resumeId}`, {
        headers: fp ? { 'x-fingerprint': fp } : {},
      });
      if (res.ok) {
        const resume = await res.json();
        await syncResumeFromServer(resume, {
          recordHistory: true,
          saveVersion: true,
          source: 'ai',
        });
      }
    } catch (err) {
      console.error('Failed to reload resume after tool call:', err);
    }
  }, [resumeId]);

  // Reload resume data when new tool results appear during streaming
  useEffect(() => {
    const nextState = getNextToolResultReloadState(completedToolCountRef.current, messages);

    if (nextState.shouldReload) {
      completedToolCountRef.current = nextState.completedToolCount;
      reloadResume();
    }
  }, [messages, reloadResume]);

  // Load initial messages when session changes; sync tool count ref to avoid false reload
  useEffect(() => {
    if (initialMessages) {
      // Pre-calculate tool count from initial messages to avoid triggering a redundant reload
      completedToolCountRef.current = countCompletedToolParts(initialMessages);
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Check if API key is configured
    const { aiApiKey, serverAIConfigured } = useSettingsStore.getState();
    if (!aiApiKey && !serverAIConfigured) {
      const userMsg: AIChatUIMessage = {
        id: generateId(),
        role: 'user',
        parts: [{ type: 'text', text: input }],
      };
      const errorMsg: AIChatUIMessage = {
        id: generateId(),
        role: 'assistant',
        parts: [{ type: 'text', text: '__API_KEY_MISSING__' }],
      };
      // Keep these messages separate from useChat state so they never get sent to the server
      setLocalMessages((prev) => [...prev, userMsg, errorMsg]);
      setInput('');
      return;
    }

    // Clear local-only messages when user starts a real conversation
    if (localMessages.length > 0) {
      setLocalMessages([]);
    }

    clearError();
    setTerminalSessionId(sessionId);
    setLastTerminalStatus(undefined);
    sendChatMessage({ text: input });
    setInput('');
  }, [clearError, input, localMessages, sendChatMessage, sessionId]);

  const latestAssistantText = getLatestAssistantText(messages);

  // Merge real chat messages with local-only display messages
  const allMessages = useMemo(
    () => (localMessages.length > 0 ? [...messages, ...localMessages] : messages),
    [messages, localMessages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLocalMessages([]);
    setTerminalSessionId(undefined);
    setLastTerminalStatus(undefined);
    resetStreamActivity();
  }, [resetStreamActivity, setMessages]);

  const stopStreaming = useCallback(() => {
    setTerminalSessionId(sessionId);
    setLastTerminalStatus('aborted');
    resetStreamActivity();
    stop();
  }, [resetStreamActivity, sessionId, stop]);

  const resetTerminalState = useCallback(() => {
    setTerminalSessionId(undefined);
    setLastTerminalStatus(undefined);
    resetStreamActivity();
  }, [resetStreamActivity]);

  return {
    messages: allMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    error,
    streamActivity: { startedAt: streamStartedAt, hasReceivedToken: latestAssistantText.length > 0 },
    lastTerminalStatus: terminalStatus,
    clearMessages,
    sendMessage: sendChatMessage,
    stopStreaming,
    resetTerminalState,
  };
}
