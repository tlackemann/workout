import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { initNavigation } from '../input/navigation.ts';

// Spatial navigation needs init() before any useFocusable runs (main.tsx does this in the app).
initNavigation();

// Vitest runs without globals, so Testing Library can't register its own cleanup.
afterEach(() => cleanup());
