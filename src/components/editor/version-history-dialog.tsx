'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Loader2, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ResumeVersionRecord, ResumeVersionSource } from '@/types/editor';
import { listResumeVersions } from '@/lib/editor/resume-version-history';
import { restoreResumeVersion } from '@/lib/editor/resume-history-actions';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string | null;
}

const sourceVariantMap: Record<ResumeVersionSource, 'secondary' | 'outline' | 'default'> = {
  autosave: 'secondary',
  manual: 'default',
  import: 'outline',
  translate: 'outline',
  ai: 'outline',
  restore: 'default',
  checkpoint: 'secondary',
};

export function VersionHistoryDialog({
  open,
  onOpenChange,
  resumeId,
}: VersionHistoryDialogProps) {
  const t = useTranslations('editor.versionHistory');
  const [versions, setVersions] = useState<ResumeVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  );

  const loadVersions = useCallback(async () => {
    if (!resumeId) {
      setVersions([]);
      return;
    }

    setIsLoading(true);
    try {
      setVersions(await listResumeVersions(resumeId));
    } catch (error) {
      console.error('Failed to load local resume versions:', error);
      toast.error(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [resumeId, t]);

  useEffect(() => {
    if (open) {
      void loadVersions();
    }
  }, [open, loadVersions]);

  const handleRestore = useCallback(async (version: ResumeVersionRecord) => {
    setRestoringId(version.id);
    try {
      const result = await restoreResumeVersion(version);
      if (result.status === 'noop') {
        toast.info(t('restoreNoop'));
        return;
      }

      toast.success(t('restoreSuccess'));
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to restore local resume version:', error);
      const message =
        error instanceof Error && /restore verification failed/i.test(error.message)
          ? t('restoreVerificationFailed')
          : t('restoreError');
      toast.error(message);
    } finally {
      setRestoringId(null);
    }
  }, [onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-brand" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : versions.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500">
              <History className="h-8 w-8 text-zinc-300" />
              <p>{t('empty')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[26rem] pr-3">
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {index === 0 ? t('latest') : t('versionLabel', { index: versions.length - index })}
                          </p>
                          <Badge variant={sourceVariantMap[version.source]}>
                            {t(`source.${version.source}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {formatter.format(version.createdAt)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {t('summary', {
                            template: version.snapshot.template,
                            language: version.snapshot.language,
                            sections: version.snapshot.sections.length,
                          })}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoringId === version.id}
                        onClick={() => void handleRestore(version)}
                        className="cursor-pointer gap-1"
                      >
                        {restoringId === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        {t('restore')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
