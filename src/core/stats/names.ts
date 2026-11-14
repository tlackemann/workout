import type { Library } from '../library/index.ts';

/** 'leg-press-calf-raise' → 'Leg Press Calf Raise' (for exercises no longer in the library). */
export function humanizeId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function exerciseLabel(id: string, library: Library): { readonly name: string; readonly known: boolean } {
  const exercise = library.get(id);
  return exercise ? { name: exercise.name, known: true } : { name: humanizeId(id), known: false };
}
