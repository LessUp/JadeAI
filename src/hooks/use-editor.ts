'use client';

import { useCallback, useEffect } from 'react';
import { useResumeStore } from '@/stores/resume-store';
import { useEditorStore } from '@/stores/editor-store';
import { syncResumeFromServer } from '@/lib/editor/resume-history-actions';

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

export function useEditor(resumeId: string) {
  const { sections, currentResume, updateSection, addSection, removeSection, reorderSections, reset: resetResume } = useResumeStore();
  const { reset: resetEditor } = useEditorStore();

  const loadResume = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/resume/${resumeId}`, { headers: getHeaders(), signal });
      if (res.ok && !signal?.aborted) {
        const data = await res.json();
        if (signal?.aborted) return;
        await syncResumeFromServer({
          ...data,
          sections: data.sections || [],
          themeConfig: data.themeConfig || {},
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        }, {
          saveVersion: true,
          source: 'checkpoint',
        });
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('Failed to load resume:', error);
    }
  }, [resumeId]);

  useEffect(() => {
    // Aborting the previous load prevents a slow response for an older
    // resumeId from overwriting the store after a fast navigation (the
    // effect cleanup fires when resumeId changes).
    const controller = new AbortController();
    void loadResume(controller.signal);

    return () => {
      controller.abort();
      resetResume();
      resetEditor();
    };
  }, [loadResume, resetResume, resetEditor]);

  return {
    resume: currentResume,
    sections,
    updateSection,
    addSection,
    removeSection,
    reorderSections,
    loadResume,
  };
}
