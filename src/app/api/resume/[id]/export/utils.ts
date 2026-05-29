import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { buildThemeCss } from '@/lib/resume-theme/build-theme-css';
import type {
  PersonalInfoContent,
  SkillsContent,
  SummaryContent,
  ThemeConfig,
} from '@/types/resume';

export type ResumeWithSections = NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>>;
export type Section = ResumeWithSections['sections'][number];

// ─── Helpers ──────────────────────────────────────────────────

export function esc(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safe(val: unknown): string {
  return val != null ? String(val) : '';
}

/** Join degree and field with separator */
export function degreeField(degree: string, field: string | undefined): string {
  if (!field) return degree;
  return `${degree} - ${field}`;
}

/** Lightweight markdown → HTML for resume text fields (summary, descriptions, highlights).
 *  Supports: **bold**, `code`, line breaks, and "- item" lists. */
export function md(text: unknown): string {
  if (text == null) return '';
  let s = String(text);
  // 1. Escape HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // 2. Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 3. Inline code: `text`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 4. No newlines → return inline
  if (!s.includes('\n')) return s;
  // 5. Process lines for lists and line breaks
  const lines = s.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    const lm = line.match(/^[-–•]\s+(.*)/);
    if (lm) {
      if (!inList) { html += '<ul style="margin:2px 0;padding-left:1.5em;list-style-type:disc">'; inList = true; }
      html += `<li>${lm[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += (html && !html.endsWith('>') ? '<br>' : '') + line;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

// ─── Section empty check ──────────────────────────────────────

export function isSectionEmpty(section: Section): boolean {
  const content = section.content as any;
  if (section.type === 'summary') return !(content as SummaryContent).text;
  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories;
    return !categories?.length || categories.every((cat: any) => !cat.skills?.length);
  }
  if ('items' in content) return !content.items?.length;
  return false;
}

// ─── HTML helpers ─────────────────────────────────────────────

export function visibleSections(resume: ResumeWithSections): Section[] {
  return resume.sections.filter((s: Section) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s));
}

export function getPersonalInfo(resume: ResumeWithSections): PersonalInfoContent {
  const sec = resume.sections.find((s: Section) => s.type === 'personal_info');
  return (sec?.content || {}) as PersonalInfoContent;
}

export function buildHighlights(highlights: string[] | undefined, liClass: string, bulletStyle?: string): string {
  if (!highlights?.length) return '';
  if (bulletStyle === 'custom-dot') {
    return highlights.map(h =>
      `<li class="flex items-start gap-2 text-sm text-zinc-600"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style="background:linear-gradient(135deg,#7c3aed,#f97316)"></span>${md(h)}</li>`
    ).join('');
  }
  return highlights.filter(Boolean).map(h => `<li class="${liClass}">${md(h)}</li>`).join('');
}

function normalizeSkillCategories(content: SkillsContent) {
  return (content.categories || [])
    .map((category, index) => ({
      id: category.id || `skill-category-${index}`,
      name: safe(category.name).trim(),
      skills: (category.skills || []).map((skill) => safe(skill).trim()).filter(Boolean),
    }))
    .filter((category) => category.skills.length > 0);
}

interface GroupedSkillPillsOptions {
  labelStyle?: string;
  groupGap?: string;
  skillsGap?: string;
  pillClass?: string;
  pillStyle?: string;
}

export function buildGroupedSkillPillsHtml(content: SkillsContent, options: GroupedSkillPillsOptions = {}): string {
  const {
    labelStyle = '',
    groupGap = '6px',
    skillsGap = '8px',
    pillClass = '',
    pillStyle = '',
  } = options;
  const categories = normalizeSkillCategories(content);

  return `<div style="display:flex;flex-direction:column;gap:12px">${categories.map((category) => `
    <div style="display:flex;flex-direction:column;gap:${groupGap}">
      ${category.name ? `<p style="font-size:12px;font-weight:600;${labelStyle}">${esc(category.name)}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:${skillsGap}">${category.skills.map((skill) =>
        `<span class="${pillClass}" style="${pillStyle}">${esc(skill)}</span>`
      ).join('')}</div>
    </div>
  `).join('')}</div>`;
}

interface GroupedSkillLinesOptions {
  labelStyle?: string;
  valueStyle?: string;
  separator?: string;
}

export function buildGroupedSkillLinesHtml(content: SkillsContent, options: GroupedSkillLinesOptions = {}): string {
  const {
    labelStyle = 'color:#3f3f46;',
    valueStyle = 'color:#52525b;',
    separator = ' / ',
  } = options;
  const categories = normalizeSkillCategories(content);

  return `<div style="display:flex;flex-direction:column;gap:6px">${categories.map((category) => `
    <div style="display:flex;gap:8px;font-size:14px">
      ${category.name ? `<span style="flex-shrink:0;font-weight:500;${labelStyle}">${esc(category.name)}:</span>` : ''}
      <span style="${valueStyle}">${esc(category.skills.join(separator))}</span>
    </div>
  `).join('')}</div>`;
}

// ─── QR codes inline HTML (SVGs pre-generated in builders.ts) ─

export function buildQrCodesHtml(section: Section): string {
  const c = section.content as any;
  const svgs = (c._qrSvgs || {}) as Record<string, string>;
  const items = (c.items || []).filter((q: any) => q.url?.trim() && svgs[q.id]);
  if (items.length === 0) return '';
  return `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px 24px;padding-top:4px">${items.map((qr: any) =>
    `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:96px">${svgs[qr.id]}<span style="font-size:10px;color:#6b7280;line-height:1.2;text-align:center;word-break:break-all;max-width:96px">${esc(qr.label)}</span></div>`
  ).join('')}</div>`;
}

// ─── Theme CSS for HTML export ────────────────────────────────

export { DEFAULT_THEME } from '@/lib/resume-theme/build-theme-css';

export function buildExportThemeCSS(theme: ThemeConfig, template: string): string {
  return buildThemeCss({
    selector: '.resume-export',
    template,
    theme,
    includeNeedsPadding: true,
  });
}
