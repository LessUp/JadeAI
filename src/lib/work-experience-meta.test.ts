import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatWorkExperienceOrganization,
  normalizeWorkExperienceMetadataForDisplay,
} from './work-experience-meta';

test('formats work organization text from team and company', () => {
  assert.equal(formatWorkExperienceOrganization({ team: 'AI专项组', company: '华大基因' }), 'AI专项组 | 华大基因');
  assert.equal(formatWorkExperienceOrganization({ team: 'AI专项组', company: '' }), 'AI专项组');
  assert.equal(formatWorkExperienceOrganization({ team: '', company: '华大基因' }), '华大基因');
  assert.equal(formatWorkExperienceOrganization({ team: 'AI专项组', company: 'AI专项组 | 华大基因' }), 'AI专项组 | 华大基因');
});

test('normalizes work experience company for preview/export display', () => {
  const resume = {
    template: 'classic',
    sections: [
      {
        type: 'summary',
        content: { text: 'summary' },
      },
      {
        type: 'work_experience',
        content: {
          items: [
            {
              id: 'w1',
              company: '华大基因',
              team: 'AI专项组',
              position: '软件开发工程师',
              location: '',
              startDate: '2025-08',
              endDate: null,
              current: true,
              description: '',
              technologies: [],
              highlights: [],
            },
          ],
        },
      },
    ],
  } as any;

  const normalized = normalizeWorkExperienceMetadataForDisplay(resume);

  assert.equal(normalized.sections[1].content.items[0].company, 'AI专项组 | 华大基因');
  assert.equal(normalized.sections[1].content.items[0].team, 'AI专项组');
  assert.equal(resume.sections[1].content.items[0].company, '华大基因');
});

test('returns original resume when no work metadata change is needed', () => {
  const resume = {
    sections: [
      {
        type: 'work_experience',
        content: {
          items: [
            {
              id: 'w1',
              company: '华大基因',
              position: '软件开发工程师',
            },
          ],
        },
      },
    ],
  } as any;

  const normalized = normalizeWorkExperienceMetadataForDisplay(resume);

  assert.equal(normalized, resume);
});
