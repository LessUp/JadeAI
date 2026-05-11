import type { ResumeSection, ThemeConfig } from './resume';

export interface EditorState {
  selectedSectionId: string | null;
  selectedItemId: string | null;
  isDragging: boolean;
  showAiChat: boolean;
  zoom: number;
}

export type ResumeVersionSource =
  | 'autosave'
  | 'manual'
  | 'import'
  | 'translate'
  | 'ai'
  | 'restore'
  | 'checkpoint';

export interface ResumeDraftSnapshot {
  title: string;
  template: string;
  themeConfig: ThemeConfig;
  language: string;
  sections: ResumeSection[];
}

export interface ResumeSnapshot {
  draft: ResumeDraftSnapshot;
  timestamp: number;
  source?: ResumeVersionSource;
}

export interface ResumeVersionRecord {
  id: string;
  resumeId: string;
  snapshot: ResumeDraftSnapshot;
  source: ResumeVersionSource;
  createdAt: number;
}

export type DragItemType = 'section' | 'item' | 'new-section';

export interface DragData {
  type: DragItemType;
  sectionId?: string;
  itemId?: string;
  sectionType?: string;
}
