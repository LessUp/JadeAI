import type { CSSProperties } from 'react';
import type { SkillsContent } from '@/types/resume';
import { cn } from '@/lib/utils';

type NormalizedSkillCategory = {
  id: string;
  name: string;
  skills: string[];
};

function normalizeSkillCategories(content: SkillsContent): NormalizedSkillCategory[] {
  return (content.categories || [])
    .map((category, index) => ({
      id: category.id || `skill-category-${index}`,
      name: (category.name || '').trim(),
      skills: (category.skills || []).map((skill) => skill.trim()).filter(Boolean),
    }))
    .filter((category) => category.skills.length > 0);
}

interface GroupedSkillPillsProps {
  content: SkillsContent;
  className?: string;
  groupClassName?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  skillsClassName?: string;
  pillClassName?: string;
  pillStyle?: CSSProperties;
}

export function GroupedSkillPills({
  content,
  className,
  groupClassName,
  labelClassName,
  labelStyle,
  skillsClassName,
  pillClassName,
  pillStyle,
}: GroupedSkillPillsProps) {
  const categories = normalizeSkillCategories(content);

  return (
    <div className={cn('space-y-3', className)}>
      {categories.map((category) => (
        <div key={category.id} className={cn('space-y-1.5', groupClassName)}>
          {category.name && (
            <p className={cn('text-xs font-semibold', labelClassName)} style={labelStyle}>
              {category.name}
            </p>
          )}
          <div className={cn('flex flex-wrap gap-2', skillsClassName)}>
            {category.skills.map((skill, index) => (
              <span key={`${category.id}-${index}`} className={pillClassName} style={pillStyle}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface GroupedSkillLinesProps {
  content: SkillsContent;
  className?: string;
  rowClassName?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  valueClassName?: string;
  valueStyle?: CSSProperties;
  separator?: string;
}

export function GroupedSkillLines({
  content,
  className,
  rowClassName,
  labelClassName,
  labelStyle,
  valueClassName,
  valueStyle,
  separator = ' / ',
}: GroupedSkillLinesProps) {
  const categories = normalizeSkillCategories(content);

  return (
    <div className={cn('space-y-1.5', className)}>
      {categories.map((category) => (
        <div key={category.id} className={cn('flex gap-2 text-sm', rowClassName)}>
          {category.name && (
            <span className={cn('shrink-0 font-medium', labelClassName)} style={labelStyle}>
              {category.name}:
            </span>
          )}
          <span className={valueClassName} style={valueStyle}>
            {category.skills.join(separator)}
          </span>
        </div>
      ))}
    </div>
  );
}
