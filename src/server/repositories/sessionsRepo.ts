import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';
import type { Day } from '../../core/days.ts';

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type SessionStatus = SessionRow['status'];

export const FINISHED: readonly SessionStatus[] = ['completed', 'ended_early'];

export interface SessionsRepository {
  create(row: NewSessionRow): SessionRow;
  findById(id: string): SessionRow | null;
  findByStatus(status: SessionStatus): SessionRow[];
  update(id: string, patch: Partial<NewSessionRow>): SessionRow | null;
  list(limit: number): SessionRow[];
  recentFinished(day: Day | null, limit: number): SessionRow[];
  remove(id: string): void;
}

export function createSessionsRepo(db: Db): SessionsRepository {
  const findById = (id: string) => db.select().from(sessions).where(eq(sessions.id, id)).get() ?? null;
  return {
    create(row) {
      db.insert(sessions).values(row).run();
      const created = findById(row.id);
      if (!created) throw new Error(`Failed to create session ${row.id}`);
      return created;
    },
    findById,
    findByStatus(status) {
      return db.select().from(sessions).where(eq(sessions.status, status)).orderBy(desc(sessions.createdAt)).all();
    },
    update(id, patch) {
      db.update(sessions).set(patch).where(eq(sessions.id, id)).run();
      return findById(id);
    },
    list(limit) {
      return db.select().from(sessions).where(inArray(sessions.status, [...FINISHED])).orderBy(desc(sessions.createdAt)).limit(limit).all();
    },
    recentFinished(day, limit) {
      const finished = inArray(sessions.status, [...FINISHED]);
      const where = day ? and(finished, eq(sessions.day, day)) : finished;
      return db.select().from(sessions).where(where).orderBy(desc(sessions.endedAt)).limit(limit).all();
    },
    remove(id) {
      db.delete(sessions).where(eq(sessions.id, id)).run();
    },
  };
}
