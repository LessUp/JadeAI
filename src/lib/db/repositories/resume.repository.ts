import { eq, desc, sql, and } from 'drizzle-orm';
import { db, transaction } from '../index';
import { resumes, resumeSections } from '../schema';
import { mergeThemeConfig, type ThemeConfigInput } from '@/lib/resume-theme/theme-config';

type CreateResumeData = {
  userId: string;
  title?: string;
  template?: string;
  language?: string;
  themeConfig?: ThemeConfigInput | null;
};

type MaybePromise<T> = T | Promise<T>;

type ResumeDraftMetadata = Partial<{
  title: string;
  template: string;
  themeConfig: unknown;
  language: string;
}>;

export type ResumeDraftSectionInput = {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content?: unknown;
};

export type SaveResumeDraftInput = {
  userId: string;
  metadata?: ResumeDraftMetadata;
  sections?: ResumeDraftSectionInput[];
};

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
}

function chain<T, U>(value: MaybePromise<T>, next: (value: T) => MaybePromise<U>): MaybePromise<U> {
  return isPromiseLike(value) ? value.then(next) : next(value);
}

function sequence<T>(items: T[], run: (item: T) => MaybePromise<unknown>): MaybePromise<void> {
  let current: MaybePromise<unknown> = undefined;
  for (const item of items) {
    current = chain(current, () => run(item));
  }
  return chain(current, () => undefined);
}

function readAll<T = any>(query: any): MaybePromise<T[]> {
  return typeof query.all === 'function' ? query.all() : query;
}

function runQuery(query: any): MaybePromise<unknown> {
  return typeof query.run === 'function' ? query.run() : query;
}

function compactMetadata(metadata: ResumeDraftMetadata = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function findByIdInExecutor(executor: any, id: string) {
  return chain(readAll(executor.select().from(resumes).where(eq(resumes.id, id)).limit(1)), (resume: any[]) => {
    if (!resume[0]) return null;
    return chain(
      readAll(executor.select().from(resumeSections).where(eq(resumeSections.resumeId, id)).orderBy(resumeSections.sortOrder)),
      (sections: any[]) => ({ ...resume[0], sections }),
    );
  });
}

function findByIdForUserInExecutor(executor: any, id: string, userId: string) {
  return chain(
    readAll(executor.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, userId))).limit(1)),
    (resume: any[]) => {
      if (!resume[0]) return null;
      return chain(
        readAll(executor.select().from(resumeSections).where(eq(resumeSections.resumeId, id)).orderBy(resumeSections.sortOrder)),
        (sections: any[]) => ({ ...resume[0], sections }),
      );
    },
  );
}

export const resumeRepository = {
  async findAllByUserId(userId: string) {
    return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.updatedAt));
  },

  async findById(id: string) {
    return findByIdInExecutor(db, id);
  },

  async findByIdForUser(id: string, userId: string) {
    return findByIdForUserInExecutor(db, id, userId);
  },

  async saveDraft(id: string, data: SaveResumeDraftInput) {
    return transaction((tx) =>
      chain(findByIdForUserInExecutor(tx, id, data.userId), (resume: any) => {
        if (!resume) return null;

        const metadata = compactMetadata(data.metadata);
        const updateMetadata =
          Object.keys(metadata).length > 0
            ? runQuery(
                tx
                  .update(resumes)
                  .set({ ...metadata, updatedAt: new Date() } as any)
                  .where(and(eq(resumes.id, id), eq(resumes.userId, data.userId))),
              )
            : undefined;

        return chain(updateMetadata, () => {
          if (!data.sections) {
            return findByIdForUserInExecutor(tx, id, data.userId);
          }

          const existingSections = resume.sections as { id: string }[];
          const incomingSections = data.sections;
          const existingIds = new Set(existingSections.map((section) => section.id));
          const incomingIds = new Set(incomingSections.map((section) => section.id));
          const removedSections = existingSections.filter((section) => !incomingIds.has(section.id));

          return chain(
            sequence(removedSections, (section) =>
              runQuery(tx.delete(resumeSections).where(and(eq(resumeSections.id, section.id), eq(resumeSections.resumeId, id)))),
            ),
            () =>
              chain(
                sequence(incomingSections, (section) => {
                  if (existingIds.has(section.id)) {
                    return runQuery(
                      tx
                        .update(resumeSections)
                        .set({
                          title: section.title,
                          sortOrder: section.sortOrder,
                          visible: section.visible,
                          content: section.content,
                          updatedAt: new Date(),
                        } as any)
                        .where(and(eq(resumeSections.id, section.id), eq(resumeSections.resumeId, id))),
                    );
                  }

                  return runQuery(
                    tx.insert(resumeSections).values({
                      id: section.id,
                      resumeId: id,
                      type: section.type,
                      title: section.title,
                      sortOrder: section.sortOrder,
                      visible: section.visible,
                      content: section.content || {},
                    } as any),
                  );
                }),
                () => findByIdForUserInExecutor(tx, id, data.userId),
              ),
          );
        });
      }),
    );
  },


  async replaceDraftForUser(data: {
    id: string;
    userId: string;
    title?: string;
    template?: string;
    themeConfig?: ThemeConfigInput | null;
    language?: string;
    sections?: ResumeDraftSectionInput[];
  }) {
    return this.saveDraft(data.id, {
      userId: data.userId,
      metadata: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.template !== undefined ? { template: data.template } : {}),
        ...(data.themeConfig !== undefined ? { themeConfig: data.themeConfig } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
      },
      sections: data.sections,
    });
  },

  async create(data: CreateResumeData) {
    const id = crypto.randomUUID();
    const normalizedThemeConfig =
      data.themeConfig === undefined || data.themeConfig === null
        ? undefined
        : mergeThemeConfig(data.themeConfig);
    await db.insert(resumes).values({
      id,
      userId: data.userId,
      title: data.title || '未命名简历',
      template: data.template || 'classic',
      language: data.language || 'zh',
      ...(normalizedThemeConfig ? { themeConfig: normalizedThemeConfig } : {}),
    });
    return this.findById(id);
  },

  async update(id: string, data: Partial<{ title: string; template: string; themeConfig: unknown; language: string }>) {
    const updateData = {
      ...data,
      ...(data.themeConfig !== undefined ? { themeConfig: mergeThemeConfig(data.themeConfig as ThemeConfigInput | null) } : {}),
      updatedAt: new Date(),
    };
    await db.update(resumes).set(updateData as any).where(eq(resumes.id, id));
    return this.findById(id);
  },

  async delete(id: string) {
    await db.delete(resumes).where(eq(resumes.id, id));
  },

  async duplicate(id: string, userId: string, titleOverride?: string) {
    const original = await this.findById(id);
    if (!original) return null;

    const newId = crypto.randomUUID();
    await db.insert(resumes).values({
      id: newId,
      userId,
      title: titleOverride ?? `${original.title} (副本)`,
      template: original.template,
      themeConfig: original.themeConfig,
      language: original.language,
    });

    for (const section of original.sections) {
      await db.insert(resumeSections).values({
        id: crypto.randomUUID(),
        resumeId: newId,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        visible: section.visible,
        content: section.content,
      });
    }

    return this.findById(newId);
  },

  // Share operations
  async findByShareToken(token: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.shareToken, token)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, resume[0].id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async incrementViewCount(id: string) {
    await db.update(resumes).set({ viewCount: sql`${resumes.viewCount} + 1` } as any).where(eq(resumes.id, id));
  },

  async updateShareSettings(id: string, settings: { isPublic?: boolean; shareToken?: string | null; sharePassword?: string | null }) {
    await db.update(resumes).set({ ...settings, updatedAt: new Date() } as any).where(eq(resumes.id, id));
  },

  // Section operations
  async createSection(data: { id?: string; resumeId: string; type: string; title: string; sortOrder: number; visible?: boolean; content?: unknown }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(resumeSections).values({
      id,
      resumeId: data.resumeId,
      type: data.type,
      title: data.title,
      sortOrder: data.sortOrder,
      visible: data.visible ?? true,
      content: data.content || {},
    } as any);
    return db.select().from(resumeSections).where(eq(resumeSections.id, id)).limit(1).then((r: any[]) => r[0]);
  },

  async updateSection(id: string, data: Partial<{ title: string; sortOrder: number; visible: boolean; content: unknown }>) {
    await db.update(resumeSections).set({ ...data, updatedAt: new Date() } as any).where(eq(resumeSections.id, id));
  },

  async deleteSection(id: string) {
    await db.delete(resumeSections).where(eq(resumeSections.id, id));
  },

  async updateSectionOrder(sections: { id: string; sortOrder: number }[]) {
    for (const s of sections) {
      await db.update(resumeSections).set({ sortOrder: s.sortOrder, updatedAt: new Date() }).where(eq(resumeSections.id, s.id));
    }
  },
};
