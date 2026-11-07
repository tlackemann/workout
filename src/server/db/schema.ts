import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  json: text('json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const exercisePrefs = sqliteTable('exercise_prefs', {
  exerciseId: text('exercise_id').primaryKey(),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  startLoad: real('start_load'),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    day: text('day', { enum: ['push', 'pull', 'legs'] }).notNull(),
    status: text('status', { enum: ['planned', 'active', 'completed', 'ended_early', 'abandoned'] }).notNull(),
    length: text('length', { enum: ['quick', 'standard', 'long'] }).notNull(),
    seed: integer('seed').notNull(),
    planJson: text('plan_json').notNull(),
    stateJson: text('state_json'),
    stateRev: integer('state_rev').notNull().default(0),
    schemaVersion: integer('schema_version').notNull(),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    endedAt: integer('ended_at'),
  },
  (t) => [index('sessions_status_idx').on(t.status), index('sessions_day_idx').on(t.day, t.createdAt)],
);

export const setLogs = sqliteTable(
  'set_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    setIndex: integer('set_index').notNull(),
    exerciseId: text('exercise_id').notNull(),
    kind: text('kind', { enum: ['warmup', 'working'] }).notNull(),
    reps: integer('reps').notNull(),
    load: real('load').notNull(),
    targetReps: integer('target_reps').notNull(),
    targetLoad: real('target_load').notNull(),
    repMin: integer('rep_min').notNull(),
    repMax: integer('rep_max').notNull(),
    plannedSets: integer('planned_sets').notNull(),
    loggedAt: integer('logged_at').notNull(),
  },
  (t) => [
    uniqueIndex('set_logs_unique').on(t.sessionId, t.position, t.setIndex),
    index('set_logs_exercise_idx').on(t.exerciseId, t.loggedAt),
  ],
);
