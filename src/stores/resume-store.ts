import { create } from 'zustand';
import { toast } from 'sonner';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';
import type { ResumeVersionSource } from '@/types/editor';
import { AUTOSAVE_DELAY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import {
  areResumeDraftSnapshotsEqual,
  createResumeDraftSnapshot,
} from '@/lib/editor/resume-draft';
import { saveResumeVersion } from '@/lib/editor/resume-version-history';
import {
  getAutoSaveFailureCopy,
  getLocalVersionHistoryFailureCopy,
} from '@/lib/editor/resume-version-history-status';
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

let hasWarnedAboutLocalVersionHistoryFailure = false;
let hasWarnedAboutAutoSaveFailure = false;

function handleLocalVersionHistoryFailure(error: unknown) {
  console.error('Failed to save local resume version:', error);

  if (typeof window === 'undefined' || hasWarnedAboutLocalVersionHistoryFailure) {
    return;
  }

  hasWarnedAboutLocalVersionHistoryFailure = true;
  const copy = getLocalVersionHistoryFailureCopy(navigator.language);
  toast.warning(copy.title, { description: copy.description });
}

function handleAutoSaveFailure(error: unknown) {
  console.error('Failed to auto-save resume:', error);

  if (typeof window === 'undefined' || hasWarnedAboutAutoSaveFailure) {
    return;
  }

  hasWarnedAboutAutoSaveFailure = true;
  const copy = getAutoSaveFailureCopy(navigator.language);
  toast.error(copy.title, { description: copy.description });
}

function parseDateInput(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeServerResume(
  raw: unknown,
  fallbackResume: Resume,
  fallbackSections: ResumeSection[]
): Resume | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Partial<Resume> & { sections?: unknown };
  const sectionSource = Array.isArray(value.sections) ? value.sections : fallbackSections;

  const sections = sectionSource.map((sectionLike, index) => {
    const section = sectionLike as Partial<ResumeSection>;
    const now = new Date();
    return {
      id: typeof section.id === 'string' && section.id ? section.id : generateId(),
      resumeId:
        typeof section.resumeId === 'string' && section.resumeId
          ? section.resumeId
          : fallbackResume.id,
      type: typeof section.type === 'string' && section.type ? section.type : 'custom',
      title: typeof section.title === 'string' ? section.title : '',
      sortOrder:
        typeof section.sortOrder === 'number' && Number.isFinite(section.sortOrder)
          ? section.sortOrder
          : index,
      visible: section.visible !== false,
      content: (section.content ?? {}) as SectionContent,
      createdAt: parseDateInput(section.createdAt, now),
      updatedAt: parseDateInput(section.updatedAt, now),
    } satisfies ResumeSection;
  });

  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallbackResume.id,
    userId:
      typeof value.userId === 'string' && value.userId
        ? value.userId
        : fallbackResume.userId,
    title: typeof value.title === 'string' ? value.title : fallbackResume.title,
    template:
      typeof value.template === 'string' ? value.template : fallbackResume.template,
    themeConfig: (value.themeConfig ?? fallbackResume.themeConfig) as Resume['themeConfig'],
    isDefault:
      typeof value.isDefault === 'boolean' ? value.isDefault : fallbackResume.isDefault,
    language:
      typeof value.language === 'string' ? value.language : fallbackResume.language,
    sections,
    createdAt: parseDateInput(value.createdAt, fallbackResume.createdAt),
    updatedAt: parseDateInput(value.updatedAt, fallbackResume.updatedAt),
  };
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

    // Normalize: ensure all items/categories in section content have id fields.
    // Work on a clone so the caller's object is never mutated in place (the
    // clone also keeps prior zustand snapshots intact).
    const sections = (resume.sections || []).map((s) => {
      const content = structuredClone((s.content ?? {}) as unknown) as Record<string, unknown>;
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
    const requestedDraftSnapshot = createResumeDraftSnapshot({
      ...currentResume,
      sections,
    });

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
        handleLocalVersionHistoryFailure(error);
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

      // Guard against a stale save applying its response to the wrong resume:
      // if the store was cleared (unmount) or now shows a different resume
      // (the user navigated while this PUT was in flight), don't write state
      // back — doing so would dirty/corrupt the other resume's view.
      const storeResumeAfterSave = get().currentResume;
      if (!storeResumeAfterSave || storeResumeAfterSave.id !== currentResume.id) return;

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        // Store was reset while the save was in flight — no one is listening.
        if (!get().currentResume) return;
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to save resume'
        );
      }

      const persistedPayload = await response.json().catch(() => null);
      const persistedResume = normalizeServerResume(
        persistedPayload,
        currentResume,
        sections
      );
      const latestState = get();
      const latestDraftSnapshot = latestState.currentResume
        ? createResumeDraftSnapshot({
          ...latestState.currentResume,
          sections: latestState.sections,
        })
        : null;
      const unchangedSinceRequest =
        latestDraftSnapshot !== null &&
        areResumeDraftSnapshotsEqual(latestDraftSnapshot, requestedDraftSnapshot);

      hasWarnedAboutAutoSaveFailure = false;
      hasWarnedAboutLocalVersionHistoryFailure = false;
      if (unchangedSinceRequest) {
        if (persistedResume) {
          get().setResume(persistedResume);
        } else {
          set({ isDirty: false });
        }
      } else {
        set((state) => {
          // Store was reset while the save was in flight (e.g. editor unmount) —
          // nothing left to re-save, and marking dirty would leave residue.
          if (!state.currentResume) {
            return {};
          }
          return {
            currentResume: persistedResume
              ? {
                ...state.currentResume,
                updatedAt: persistedResume.updatedAt,
              }
              : state.currentResume,
            isDirty: true,
          };
        });
        if (get().currentResume) {
          get()._scheduleSave();
        }
      }

      const snapshotForVersion = unchangedSinceRequest
        ? (() => {
          const syncedState = get();
          if (!syncedState.currentResume) {
            return requestedDraftSnapshot;
          }
          return createResumeDraftSnapshot({
            ...syncedState.currentResume,
            sections: syncedState.sections,
          });
        })()
        : requestedDraftSnapshot;

      try {
        await saveResumeVersion({
          resumeId: currentResume.id,
          snapshot: snapshotForVersion,
          source,
        });
      } catch (error) {
        handleLocalVersionHistoryFailure(error);
      }
    } finally {
      // Only clear isSaving for the resume this save belongs to — if the user
      // already navigated to another resume, its own in-flight save flag must
      // not be touched (clearing it could allow a duplicate concurrent PUT).
      const currentStoreResume = get().currentResume;
      if (!currentStoreResume || currentStoreResume.id === currentResume.id) {
        set({ isSaving: false });
      }
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
        handleAutoSaveFailure(error);
      });
    }, delay);

    set({ _saveTimeout: timeout });
  },

  reset: () => {
    const { _saveTimeout, currentResume, isDirty, isSaving } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);
    // Flush any edits still pending in the autosave window before clearing the
    // store — the editor page unmounts right after reset(), so cancelling the
    // timer would otherwise silently discard them. save() snapshots the draft
    // synchronously, so the PUT is issued with the pre-reset state.
    if (currentResume && isDirty && !isSaving) {
      void get().save({ source: 'autosave' }).catch(() => {
        // Best-effort flush on unmount.
      });
    }
    set({
      currentResume: null,
      sections: [],
      isDirty: false,
      isSaving: false,
      _saveTimeout: null,
    });
  },
}));
