import type { Resume } from '@/types/resume';
import type { ResumeDraftSnapshot } from '@/types/editor';
export type { ResumeDraftSnapshot } from '@/types/editor';

export function cloneResumeDraftSnapshot(snapshot: ResumeDraftSnapshot): ResumeDraftSnapshot {
  return structuredClone(snapshot);
}

export function createResumeDraftSnapshot(resume: Resume): ResumeDraftSnapshot {
  return {
    title: resume.title,
    template: resume.template,
    themeConfig: structuredClone(resume.themeConfig || {}),
    language: resume.language,
    sections: structuredClone(resume.sections || []),
  };
}

export function buildResumeFromDraft(resume: Resume, draft: ResumeDraftSnapshot): Resume {
  return {
    ...resume,
    title: draft.title,
    template: draft.template,
    themeConfig: structuredClone(draft.themeConfig),
    language: draft.language,
    sections: structuredClone(draft.sections),
  };
}

export function areResumeDraftSnapshotsEqual(
  left: ResumeDraftSnapshot,
  right: ResumeDraftSnapshot
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
