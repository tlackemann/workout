import type { ExerciseDef } from './schema.ts';

export type Library = ReadonlyMap<string, ExerciseDef>;

export function indexLibrary(list: readonly ExerciseDef[]): Library {
  return new Map(list.map((e) => [e.id, e]));
}

export function requireExercise(library: Library, id: string): ExerciseDef {
  const found = library.get(id);
  if (!found) throw new Error(`Unknown exercise "${id}"`);
  return found;
}

/** Seconds of actual lifting for one rep. */
export function repSeconds(exercise: ExerciseDef): number {
  return exercise.tempo.down + exercise.tempo.up;
}
