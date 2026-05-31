'use client';

import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableRichText } from '../fields/editable-rich-text';
import type { ResumeSection, SummaryContent } from '@/types/resume';

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<SummaryContent>) => void;
}

const BLOCK_SEPARATOR = '\n\n';

function parseSummaryBlocks(text: string | undefined): string[] {
  if (!text) return [''];
  return text.split(/\n{2,}/);
}

function serializeSummaryBlocks(blocks: string[]): string {
  return blocks.join(BLOCK_SEPARATOR);
}

export function SummarySection({ section, onUpdate }: Props) {
  const t = useTranslations('editor.fields');
  const content = section.content as SummaryContent;
  const blocks = parseSummaryBlocks(content.text);

  const updateBlock = (index: number, value: string) => {
    const nextBlocks = blocks.map((block, blockIndex) => (blockIndex === index ? value : block));
    onUpdate({ text: serializeSummaryBlocks(nextBlocks) });
  };

  const addBlock = () => {
    onUpdate({ text: serializeSummaryBlocks([...blocks, '']) });
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) {
      onUpdate({ text: '' });
      return;
    }

    onUpdate({ text: serializeSummaryBlocks(blocks.filter((_, blockIndex) => blockIndex !== index)) });
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div key={`summary-block-${index}`} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              {t('summaryBlock', { index: index + 1 })}
            </span>
            {blocks.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer p-1 text-zinc-400 hover:text-red-500"
                title={t('removeTextBlock')}
                onClick={() => removeBlock(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <EditableRichText
            label={t('description')}
            value={block}
            onChange={(value) => updateBlock(index, value)}
            rows={index === 0 ? 4 : 2}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addBlock} className="w-full cursor-pointer gap-1">
        <Plus className="h-3.5 w-3.5" />
        {t('addTextBlock')}
      </Button>
    </div>
  );
}
