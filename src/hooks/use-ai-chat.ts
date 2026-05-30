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

interface UseAIChatOptions {
  resumeId: string;
  sessionId?: string;
  initialMessages?: AIChatUIMessage[];
  selectedModel?: string;
}

function isCompletedToolPart(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false;

  const candidate = part as { type?: unknown; state?: unknown };
  return typeof candidate.type === 'string'
    && candidate.type.startsWith('tool-')
    && candidate.state === 'output-available';
}

export function useAIChat({ resumeId, sessionId, initialMessages, selectedModel }: UseAIChatOptions) {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<AIChatUIMessage[]>([]);
  const [lastTerminalStatus, setLastTerminalStatus] = useState<AIChatStatus | undefined>();
  const [terminalSessionId, setTerminalSessionId] = useState<string | undefined>();

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
    const completedToolCount = messages.reduce((count, m) => {
      if (m.role !== 'assistant' || !m.parts) return count;
      return count + m.parts.filter(isCompletedToolPart).length;
    }, 0);

    if (completedToolCount > completedToolCountRef.current) {
      completedToolCountRef.current = completedToolCount;
      reloadResume();
    }
  }, [messages, reloadResume]);

  // Load initial messages when session changes; sync tool count ref to avoid false reload
  useEffect(() => {
    if (initialMessages) {
      // Pre-calculate tool count from initial messages to avoid triggering a redundant reload
      const initialToolCount = initialMessages.reduce((count, m) => {
        if (m.role !== 'assistant' || !m.parts) return count;
        return count + m.parts.filter(isCompletedToolPart).length;
      }, 0);
      completedToolCountRef.current = initialToolCount;
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
    sendMessage({ text: input });
    setInput('');
  }, [clearError, input, localMessages, sendMessage, sessionId]);

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
  }, [setMessages]);

  const stopStreaming = useCallback(() => {
    setTerminalSessionId(sessionId);
    setLastTerminalStatus('aborted');
    stop();
  }, [sessionId, stop]);

  const resetTerminalState = useCallback(() => {
    setTerminalSessionId(undefined);
    setLastTerminalStatus(undefined);
  }, []);

  return {
    messages: allMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    error,
    lastTerminalStatus: terminalStatus,
    clearMessages,
    sendMessage,
    stopStreaming,
    resetTerminalState,
  };
}
