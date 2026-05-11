import { create } from 'zustand';
import type { ResumeDraftSnapshot, ResumeSnapshot, ResumeVersionSource } from '@/types/editor';
import { MAX_UNDO_STACK } from '@/lib/constants';
import {
  areResumeDraftSnapshotsEqual,
  cloneResumeDraftSnapshot,
} from '@/lib/editor/resume-draft';

interface EditorStore {
  selectedSectionId: string | null;
  selectedItemId: string | null;
  isDragging: boolean;
  showAiChat: boolean;
  showThemeEditor: boolean;
  zoom: number;
  undoStack: ResumeSnapshot[];
  redoStack: ResumeSnapshot[];
  pendingAiMessage: string | null;
  mobileActiveTab: "edit" | "preview";

  selectSection: (id: string | null) => void;
  selectItem: (id: string | null) => void;
  setDragging: (isDragging: boolean) => void;
  toggleAiChat: () => void;
  setShowAiChat: (show: boolean) => void;
  toggleThemeEditor: () => void;
  setZoom: (zoom: number) => void;
  pushSnapshot: (draft: ResumeDraftSnapshot, source?: ResumeVersionSource) => void;
  undo: (currentDraft: ResumeDraftSnapshot | null) => ResumeSnapshot | null;
  redo: (currentDraft: ResumeDraftSnapshot | null) => ResumeSnapshot | null;
  setPendingAiMessage: (message: string | null) => void;
  setMobileActiveTab: (tab: "edit" | "preview") => void;
  reset: () => void;
}

function createSnapshot(
  draft: ResumeDraftSnapshot,
  source?: ResumeVersionSource
): ResumeSnapshot {
  return {
    draft: cloneResumeDraftSnapshot(draft),
    timestamp: Date.now(),
    source,
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedSectionId: null,
  selectedItemId: null,
  isDragging: false,
  showAiChat: false,
  showThemeEditor: false,
  zoom: 100,
  undoStack: [],
  redoStack: [],
  pendingAiMessage: null,
  mobileActiveTab: "edit",

  selectSection: (id) => set({ selectedSectionId: id, selectedItemId: null }),
  selectItem: (id) => set({ selectedItemId: id }),
  setDragging: (isDragging) => set({ isDragging }),
  toggleAiChat: () => set((s) => ({ showAiChat: !s.showAiChat })),
  setShowAiChat: (show) => set({ showAiChat: show }),
  toggleThemeEditor: () => set((s) => ({ showThemeEditor: !s.showThemeEditor })),
  setZoom: (zoom) => set({ zoom }),

  pushSnapshot: (draft, source) => {
    set((state) => ({
      ...(state.undoStack.at(-1) &&
      areResumeDraftSnapshotsEqual(state.undoStack.at(-1)!.draft, draft)
        ? {}
        : {
            undoStack: [
              ...state.undoStack.slice(-MAX_UNDO_STACK + 1),
              createSnapshot(draft, source),
            ],
            redoStack: [],
          }),
    }));
  },

  undo: (currentDraft) => {
    if (!currentDraft) return null;
    const { undoStack } = get();
    if (undoStack.length === 0) return null;

    const snapshot = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [
        ...state.redoStack.slice(-MAX_UNDO_STACK + 1),
        createSnapshot(currentDraft, snapshot.source),
      ],
    }));
    return snapshot;
  },

  redo: (currentDraft) => {
    if (!currentDraft) return null;
    const { redoStack } = get();
    if (redoStack.length === 0) return null;

    const snapshot = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [
        ...state.undoStack.slice(-MAX_UNDO_STACK + 1),
        createSnapshot(currentDraft, snapshot.source),
      ],
    }));
    return snapshot;
  },

  setPendingAiMessage: (message) => set({ pendingAiMessage: message }),
  setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),

  reset: () =>
    set({
      selectedSectionId: null,
      selectedItemId: null,
      isDragging: false,
      showAiChat: false,
      showThemeEditor: false,
      zoom: 100,
      undoStack: [],
      redoStack: [],
      pendingAiMessage: null,
      mobileActiveTab: "edit",
    }),
}));
