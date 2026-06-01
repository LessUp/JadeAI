import { eq, desc, sql, and, inArray } from 'drizzle-orm';
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

type ReplaceResumeDraftSection = {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content: unknown;
};

type ReplaceResumeDraftData = {
  id: string;
  userId: string;
  title?: string;
  template?: string;
  themeConfig?: ThemeConfigInput | null;
  language?: string;
  sections?: ReplaceResumeDraftSection[];
};

export const resumeRepository = {
  async findAllByUserId(userId: string) {
    return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.updatedAt));
  },

  async findById(id: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async findByIdForUser(id: string, userId: string) {
    const resume = await db
      .select()
      .from(resumes)
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
      .limit(1);
    if (!resume[0]) return null;
    const sections = await db
      .select()
      .from(resumeSections)
      .where(eq(resumeSections.resumeId, id))
      .orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
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

  async replaceDraftForUser(data: ReplaceResumeDraftData) {
    await transaction(async (tx) => {
      const ownedResume = await tx
        .select({ id: resumes.id })
        .from(resumes)
        .where(and(eq(resumes.id, data.id), eq(resumes.userId, data.userId)))
        .limit(1);
      if (!ownedResume[0]) {
        throw new Error('Resume not found');
      }

      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.template !== undefined) updateData.template = data.template;
      if (data.language !== undefined) updateData.language = data.language;
      if (data.themeConfig !== undefined) updateData.themeConfig = mergeThemeConfig(data.themeConfig);
      if (Object.keys(updateData).length > 0) {
        await tx.update(resumes).set({ ...updateData, updatedAt: new Date() } as any).where(eq(resumes.id, data.id));
      }

      if (!Array.isArray(data.sections)) {
        return;
      }

      const existingSections = await tx
        .select({ id: resumeSections.id })
        .from(resumeSections)
        .where(eq(resumeSections.resumeId, data.id));
      const existingIds = new Set(existingSections.map((section: { id: string }) => section.id));
      const incomingIds = new Set(data.sections.map((section) => section.id));
      const removedIds = existingSections
        .map((section: { id: string }) => section.id)
        .filter((id: string) => !incomingIds.has(id));

      if (removedIds.length > 0) {
        await tx
          .delete(resumeSections)
          .where(and(eq(resumeSections.resumeId, data.id), inArray(resumeSections.id, removedIds)));
      }

      for (const section of data.sections) {
        if (existingIds.has(section.id)) {
          await tx
            .update(resumeSections)
            .set({
              title: section.title,
              sortOrder: section.sortOrder,
              visible: section.visible,
              content: section.content,
              updatedAt: new Date(),
            } as any)
            .where(and(eq(resumeSections.id, section.id), eq(resumeSections.resumeId, data.id)));
        } else {
          await tx.insert(resumeSections).values({
            id: section.id,
            resumeId: data.id,
            type: section.type,
            title: section.title,
            sortOrder: section.sortOrder,
            visible: section.visible,
            content: section.content,
          } as any);
        }
      }
    });

    return this.findById(data.id);
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
