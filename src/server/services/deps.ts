import type { Templates } from '../../core/generator/types.ts';
import type { Library } from '../../core/library/index.ts';
import type { Repositories } from '../repositories/index.ts';

export interface Deps {
  readonly repos: Repositories;
  readonly library: Library;
  readonly templates: Templates;
  readonly now: () => number;
  readonly newId: () => string;
  readonly newSeed: () => number;
}
