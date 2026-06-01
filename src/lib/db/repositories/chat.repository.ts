import { eq, desc, and, lt, or, asc } from 'drizzle-orm';
import { db } from '../index';
import { chatSessions, chatMessages, resumes } from '../schema';

const CURSOR_SEPARATOR = '|';

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Handle epoch seconds and epoch milliseconds.
    const millis = value >= 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis);
  }
  return new Date(value);
}

function encodeCursor(createdAt: Date | string | number, id: string): string {
  return `${toDate(createdAt).toISOString()}${CURSOR_SEPARATOR}${id}`;
}

function decodeCursor(cursor: string): { createdAt: Date; id?: string } {
  const [createdAtRaw, id] = cursor.includes(CURSOR_SEPARATOR)
    ? cursor.split(CURSOR_SEPARATOR, 2)
    : [cursor, undefined];
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('Invalid pagination cursor');
  }
  return { createdAt, id };
}

export const chatRepository = {
  async findSessionsByResumeId(resumeId: string) {
    return db.select().from(chatSessions).where(eq(chatSessions.resumeId, resumeId)).orderBy(desc(chatSessions.updatedAt));
  },

  async findSessionsByResumeIdForUser(resumeId: string, userId: string) {
    return db
      .select({
        id: chatSessions.id,
        resumeId: chatSessions.resumeId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .innerJoin(resumes, eq(chatSessions.resumeId, resumes.id))
      .where(and(eq(chatSessions.resumeId, resumeId), eq(resumes.userId, userId)))
      .orderBy(desc(chatSessions.updatedAt));
  },

  async findSession(sessionId: string) {
    const rows = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
    return rows[0] ?? null;
  },

  async findSessionForUser(sessionId: string, userId: string) {
    const rows = await db
      .select({
        id: chatSessions.id,
        resumeId: chatSessions.resumeId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .innerJoin(resumes, eq(chatSessions.resumeId, resumes.id))
      .where(and(eq(chatSessions.id, sessionId), eq(resumes.userId, userId)))
      .limit(1);

    return rows[0] ?? null;
  },

  async findPaginatedMessages(sessionId: string, opts: { cursor?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 20, 50);
    const fetchCount = limit + 1;
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : undefined;

    const whereClause = cursor
      ? and(
        eq(chatMessages.sessionId, sessionId),
        cursor.id
          ? or(
            lt(chatMessages.createdAt, cursor.createdAt),
            and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
          )
          : lt(chatMessages.createdAt, cursor.createdAt),
      )
      : eq(chatMessages.sessionId, sessionId);

    let rows = await db
      .select()
      .from(chatMessages)
      .where(whereClause)
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(fetchCount);

    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);

    // Reverse to ASC order for display
    rows.reverse();

    const nextCursor = hasMore && rows.length > 0
      ? encodeCursor(rows[0].createdAt as Date | string | number, rows[0].id)
      : undefined;

    return { messages: rows, hasMore, nextCursor };
  },

  async findPaginatedMessagesForUser(sessionId: string, userId: string, opts: { cursor?: string; limit?: number } = {}) {
    const session = await this.findSessionForUser(sessionId, userId);
    if (!session) return null;
    return this.findPaginatedMessages(sessionId, opts);
  },

  async findSessionWithMessages(sessionId: string) {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
    if (!session[0]) return null;
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    return { ...session[0], messages };
  },

  async findSessionWithMessagesForUser(sessionId: string, userId: string) {
    const session = await this.findSessionForUser(sessionId, userId);
    if (!session) return null;
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    return { ...session, messages };
  },

  async createSession(data: { resumeId: string; title?: string }) {
    const id = crypto.randomUUID();
    await db.insert(chatSessions).values({
      id,
      resumeId: data.resumeId,
      title: data.title || '新对话',
    });
    return this.findSessionWithMessages(id);
  },

  async createSessionForUser(data: { resumeId: string; userId: string; title?: string }) {
    const resume = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(and(eq(resumes.id, data.resumeId), eq(resumes.userId, data.userId)))
      .limit(1);

    if (!resume[0]) {
      return null;
    }

    const id = crypto.randomUUID();
    await db.insert(chatSessions).values({
      id,
      resumeId: data.resumeId,
      title: data.title || '新对话',
    });

    return this.findSessionWithMessagesForUser(id, data.userId);
  },

  async addMessage(data: { id?: string; sessionId: string; role: 'user' | 'assistant' | 'system'; content: string; metadata?: unknown }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(chatMessages).values({
      id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata || {},
    } as any);
    await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, data.sessionId));
    return db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1).then((r: any[]) => r[0]);
  },

  async updateMessage(messageId: string, data: Partial<{ content: string; metadata: unknown }>) {
    const updateData: Partial<{ content: string; metadata: unknown }> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    await db.update(chatMessages).set(updateData as any).where(eq(chatMessages.id, messageId));
    const message = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1).then((r: any[]) => r[0] ?? null);
    if (message) {
      await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, message.sessionId));
    }
    return message;
  },

  async updateSessionTitle(sessionId: string, title: string) {
    await db.update(chatSessions).set({ title }).where(eq(chatSessions.id, sessionId));
  },

  async deleteSession(sessionId: string) {
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  },

  async deleteSessionForUser(sessionId: string, userId: string) {
    const session = await this.findSessionForUser(sessionId, userId);
    if (!session) return false;
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
    return true;
  },
};
