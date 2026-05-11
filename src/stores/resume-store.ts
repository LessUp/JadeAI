import { create } from 'zustand';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';
import type { ResumeVersionSource } from '@/types/editor';
import { AUTOSAVE_DELAY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { createResumeDraftSnapshot } from '@/lib/editor/resume-draft';
import { saveResumeVersion } from '@/lib/editor/resume-version-history';
import { useEditorStore } from '@/stores/editor-store';
import { useSettingsStore } from '@/stores/settings-store';

interface ResumeStore {
  currentResume: Resume | null;
  sections: ResumeSection[];
  isDirty: boolean;
  isSaving: boolean;
  _saveTimeout: ReturnType<typeof setTimeout> | null;

  setResume: (resume: Resume) => void;
  updateSection: (sectionId: string, content: Partial<SectionContent>) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  addSection: (section: ResumeSection) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setTemplate: (template: string) => void;
  setTitle: (title: string) => void;
  save: (options?: { source?: ResumeVersionSource; forceVersion?: boolean }) => Promise<void>;
  _scheduleSave: () => void;
  reset: () => void;
}

function pushUndoSnapshot(resume: Resume | null) {
  if (!resume) return;
  useEditorStore.getState().pushSnapshot(createResumeDraftSnapshot(resume));
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  currentResume: null,
  sections: [],
  isDirty: false,
  isSaving: false,
  _saveTimeout: null,

  setResume: (resume) => {
    // Cancel any pending autosave to prevent stale data overwriting server changes (e.g., from AI tool calls)
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    // Normalize: ensure all items/categories in section content have id fields
    const sections = (resume.sections || []).map((s) => {
      const content = s.content as unknown as Record<string, unknown>;
      const withStableIds = (value: unknown) => {
        if (!Array.isArray(value)) return value;

        return value.map((entry) => {
          if (typeof entry !== 'object' || entry === null) return entry;
          if ('id' in entry && entry.id) return entry;
          return { ...entry, id: generateId() };
        });
      };

      if (Array.isArray(content?.items)) {
        content.items = withStableIds(content.items);
      }
      if (Array.isArray(content?.categories)) {
        content.categories = withStableIds(content.categories);
      }
      return { ...s, content: content as unknown as typeof s.content };
    });

    set({
      currentResume: { ...resume, sections },
      sections,
      isDirty: false,
      _saveTimeout: null,
    });
  },

  updateSection: (sectionId, content) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, content: { ...s.content, ...content } as SectionContent } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  updateSectionTitle: (sectionId, title) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  addSection: (section) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = [...state.sections, section];
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  removeSection: (sectionId) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.filter((s) => s.id !== sectionId);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  reorderSections: (sections) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  toggleSectionVisibility: (sectionId) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  setTemplate: (template) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        currentResume: state.currentResume
          ? { ...state.currentResume, template }
          : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  setTitle: (title) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        currentResume: state.currentResume
          ? { ...state.currentResume, title }
          : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  save: async (options) => {
    const { currentResume, sections, isDirty, isSaving } = get();
    const source = options?.source ?? 'manual';
    if (!currentResume || isSaving) return;

    if (!isDirty) {
      if (!options?.forceVersion) return;

      try {
        await saveResumeVersion({
          resumeId: currentResume.id,
          snapshot: createResumeDraftSnapshot({
            ...currentResume,
            sections,
          }),
          source,
        });
      } catch (error) {
        console.error('Failed to save local resume version:', error);
      }
      return;
    }

    const { _saveTimeout } = get();
    if (_saveTimeout) {
      clearTimeout(_saveTimeout);
      set({ _saveTimeout: null });
    }

    set({ isSaving: true });
    try {
      const fingerprint = typeof window !== 'undefined'
        ? localStorage.getItem('jade_fingerprint')
        : null;

      const response = await fetch(`/api/resume/${currentResume.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({
          title: currentResume.title,
          template: currentResume.template,
          themeConfig: currentResume.themeConfig,
          language: currentResume.language,
          sections: sections.map((s, i) => ({
            id: s.id,
            type: s.type,
            title: s.title,
            sortOrder: i,
            visible: s.visible,
            content: s.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to save resume'
        );
      }

      set({ isDirty: false });

      try {
        await saveResumeVersion({
          resumeId: currentResume.id,
          snapshot: createResumeDraftSnapshot({
            ...currentResume,
            sections,
          }),
          source,
        });
      } catch (error) {
        console.error('Failed to save local resume version:', error);
      }
    } finally {
      set({ isSaving: false });
    }
  },

  _scheduleSave: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    const { autoSave, autoSaveInterval, _hydrated } = useSettingsStore.getState();

    // If settings are hydrated and autoSave is off, only mark dirty, don't auto-save
    if (_hydrated && !autoSave) {
      set({ _saveTimeout: null });
      return;
    }

    const delay = _hydrated ? autoSaveInterval : AUTOSAVE_DELAY;
    const timeout = setTimeout(() => {
      void get().save({ source: 'autosave' }).catch((error) => {
        console.error('Failed to auto-save resume:', error);
      });
    }, delay);

    set({ _saveTimeout: timeout });
  },

  reset: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);
    set({
      currentResume: null,
      sections: [],
      isDirty: false,
      isSaving: false,
      _saveTimeout: null,
    });
  },
}));
