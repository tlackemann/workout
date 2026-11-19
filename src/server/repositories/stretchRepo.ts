import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { stretchSessions } from '../db/schema.ts';

export type StretchRow = typeof stretchSessions.$inferSelect;
export type NewStretchRow = typeof stretchSessions.$inferInsert;
export type StretchStatus = StretchRow['status'];

export const STRETCH_FINISHED: readonly StretchStatus[] = ['completed', 'ended_early'];

export interface StretchRepository {
  create(row: NewStretchRow): StretchRow;
  findById(id: string): StretchRow | null;
  findByStatus(status: StretchStatus): StretchRow[];
  update(id: string, patch: Partial<NewStretchRow>): StretchRow | null;
  /** Finished sessions, most recently finished first. */
  listFinished(limit: number): StretchRow[];
  /** endedAt of every finished session (for the consistency heatmap). */
  finishedEndTimes(): number[];
  remove(id: string): void;
}

export function createStretchRepo(db: Db): StretchRepository {
  const findById = (id: string) => db.select().from(stretchSessions).where(eq(stretchSessions.id, id)).get() ?? null;
  const finished = inArray(stretchSessions.status, [...STRETCH_FINISHED]);
  return {
    create(row) {
      db.insert(stretchSessions).values(row).run();
      const created = findById(row.id);
      if (!created) throw new Error(`Failed to create stretch session ${row.id}`);
      return created;
    },
    findById,
    findByStatus(status) {
      return db.select().from(stretchSessions).where(eq(stretchSessions.status, status)).orderBy(desc(stretchSessions.createdAt)).all();
    },
    update(id, patch) {
      db.update(stretchSessions).set(patch).where(eq(stretchSessions.id, id)).run();
      return findById(id);
    },
    listFinished(limit) {
      return db.select().from(stretchSessions).where(finished).orderBy(desc(stretchSessions.endedAt)).limit(limit).all();
    },
    finishedEndTimes() {
      return db
        .select({ endedAt: stretchSessions.endedAt })
        .from(stretchSessions)
        .where(finished)
        .all()
        .flatMap((r) => (r.endedAt === null ? [] : [r.endedAt]));
    },
    remove(id) {
      db.delete(stretchSessions).where(eq(stretchSessions.id, id)).run();
    },
  };
}
