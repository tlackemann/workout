import { z } from 'zod';
import { DAYS, SESSION_LENGTHS } from '../days.ts';
import { SESSION_SCHEMA_VERSION } from './types.ts';

const int = z.number().int();
const nonNeg = z.number().nonnegative();
const kind = z.enum(['warmup', 'working']);

export const planSetSchema = z.object({
  kind,
  targetReps: int.min(0).max(100),
  targetLoad: nonNeg,
  restSec: int.min(0).max(1800),
});

export const planItemSchema = z.object({
  position: int.min(0),
  slotId: z.string().min(1).max(64),
  slotLabel: z.string().max(64),
  exerciseId: z.string().min(1).max(64),
  role: z.enum(['anchor', 'accessory']),
  repMin: int.min(0).max(100),
  repMax: int.min(0).max(100),
  amrap: z.boolean(),
  sets: z.array(planSetSchema).min(1).max(20),
  workingSets: int.min(0).max(20),
  substituted: z.boolean(),
  reason: z.enum(['first', 'progress', 'add_reps', 'deload', 'stale', 'maxed', 'promote']),
  lastLoad: nonNeg.nullable(),
});

export const planSchema = z.object({
  day: z.enum(DAYS),
  length: z.enum(SESSION_LENGTHS),
  seed: int,
  items: z.array(planItemSchema).max(30),
  droppedSlots: z.array(z.string()),
  trimmedSlots: z.array(z.string()),
  estimatedSec: nonNeg,
});

const cursorSchema = z.object({ item: int.min(0), set: int.min(0) });
const setRefSchema = z.object({ position: int.min(0), setIndex: int.min(0) });

export const setLogSchema = setRefSchema.extend({
  exerciseId: z.string().min(1).max(64),
  kind,
  reps: int.min(0).max(100),
  load: nonNeg.max(2000),
  targetReps: int.min(0).max(100),
  targetLoad: nonNeg,
  repMin: int.min(0),
  repMax: int.min(0),
  plannedSets: int.min(0),
  loggedAt: z.number(),
});

export const sessionStateSchema = z.object({
  schemaVersion: z.literal(SESSION_SCHEMA_VERSION),
  rev: int.min(0),
  sessionId: z.string().min(1).max(64),
  plan: planSchema,
  getReadySec: int.min(0).max(60),
  cursor: cursorSchema,
  phase: z.enum(['intro', 'work', 'rest', 'done']),
  phaseStartedAt: z.number(),
  endsAt: z.number().nullable(),
  paused: z.object({ at: z.number() }).nullable(),
  overlay: z.enum(['none', 'menu', 'swap', 'confirmEnd']),
  notice: z.enum(['welcome_back', 'caught_up']).nullable(),
  load: nonNeg.max(2000),
  draft: z.object({ cursor: cursorSchema, reps: int.min(0).max(100), load: nonNeg.max(2000) }).nullable(),
  logs: z.array(setLogSchema).max(300),
  skipped: z.array(setRefSchema).max(300),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  endedEarly: z.boolean(),
});
