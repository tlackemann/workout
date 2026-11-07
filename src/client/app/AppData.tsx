import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { indexLibrary, type Library } from '../../core/library/index.ts';
import { librarySchema } from '../../core/library/schema.ts';
import type { ExercisePref, Prefs, Settings } from '../../core/settings.ts';
import { LIBRARY } from '../../data/library.ts';
import { configureAudio } from '../audio/cues.ts';
import { api } from './api.ts';

interface AppDataValue {
  readonly library: Library;
  readonly settings: Settings;
  readonly prefs: Prefs;
  readonly updateSettings: (next: Settings) => void;
  readonly updatePref: (exerciseId: string, pref: ExercisePref) => Promise<void>;
  readonly saveError: string | null;
}

const AppDataContext = createContext<AppDataValue | null>(null);
const library = indexLibrary(librarySchema.parse(LIBRARY));
const SAVE_DEBOUNCE_MS = 400;

export function AppDataProvider(props: {
  readonly initial: { readonly settings: Settings; readonly prefs: Prefs };
  readonly children: ReactNode;
}) {
  const [settings, setSettings] = useState(props.initial.settings);
  const [prefs, setPrefs] = useState(props.initial.prefs);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef(0);

  useEffect(() => configureAudio(settings.audio), [settings.audio]);

  /** Optimistic update; the server write is debounced so held steppers don't spam it. */
  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api
        .saveSettings(next)
        .then(() => setSaveError(null))
        .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : 'Could not save settings'));
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updatePref = useCallback(async (exerciseId: string, pref: ExercisePref) => {
    const saved = await api.savePref(exerciseId, pref);
    setPrefs((current) => ({ ...current, [exerciseId]: saved }));
  }, []);

  const value = useMemo(
    () => ({ library, settings, prefs, updateSettings, updatePref, saveError }),
    [settings, prefs, updateSettings, updatePref, saveError],
  );
  return <AppDataContext.Provider value={value}>{props.children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
