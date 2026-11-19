import { pause as pauseNavigation, resume as resumeNavigation } from '@noriginmedia/norigin-spatial-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadOptions, step } from '../../../core/loads.ts';
import type { PlanItem } from '../../../core/plan.ts';
import { actionItemIndex } from '../../../core/session/cursor.ts';
import { currentItem } from '../../../core/session/selectors.ts';
import type { SessionState } from '../../../core/session/types.ts';
import { api } from '../../app/api.ts';
import { useAppData } from '../../app/AppData.tsx';
import { useRouter } from '../../app/router.tsx';
import { paths } from '../../app/routes.ts';
import { unlockAudio } from '../../audio/cues.ts';
import { Centered } from '../../components/Screen.tsx';
import type { RemoteAction } from '../../input/keymap.ts';
import { useRemoteKeys } from '../../input/useRemoteKeys.ts';
import { menuItems } from './menuItems.ts';
import { ConfirmEnd, PauseMenu, SwapPicker, workoutNotice } from './Overlays.tsx';
import { PlayerView } from './PlayerView.tsx';
import { useBackGuard } from './useBackGuard.ts';
import { useCueAudio } from './useCueAudio.ts';
import { usePlayerSession } from './usePlayerSession.ts';

/** Held ◀▶ repeats fast; one weight step per this many ms keeps it controllable. */
const REPEAT_STEP_MS = 120;

interface Alternatives {
  readonly data: readonly PlanItem[] | null;
  readonly error: string | null;
}

const wrap = (i: number, n: number) => (n === 0 ? 0 : (i + n) % n);

function useAlternatives(id: string, state: SessionState | null): Alternatives {
  // During the changeover rest, Swap targets the upcoming exercise (what's on screen).
  const position = state?.overlay === 'swap' ? state.plan.items[actionItemIndex(state)]?.position : undefined;
  const [alts, setAlts] = useState<Alternatives>({ data: null, error: null });
  useEffect(() => {
    if (position === undefined) return undefined;
    let cancelled = false;
    setAlts({ data: null, error: null });
    api
      .alternatives(id, position)
      .then((data) => !cancelled && setAlts({ data, error: null }))
      .catch((err: unknown) => !cancelled && setAlts({ data: null, error: err instanceof Error ? err.message : 'Could not load alternatives' }));
    return () => {
      cancelled = true;
    };
  }, [id, position]);
  return alts;
}

export function Player(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const { library, settings } = useAppData();
  const onFinished = useCallback(() => navigate(paths.summary(props.id), { replace: true }), [navigate, props.id]);
  const { state, dispatch, status, error, saveStatus, now } = usePlayerSession(props.id, onFinished);
  const [menuIndex, setMenuIndex] = useState(0);
  const [swapIndex, setSwapIndex] = useState(0);
  const [endSelected, setEndSelected] = useState(false);
  const lastStep = useRef(0);
  const alternatives = useAlternatives(props.id, state);

  useEffect(() => {
    pauseNavigation();
    return () => resumeNavigation();
  }, []);

  useEffect(() => {
    if (status === 'gone') navigate(paths.home(), { replace: true });
  }, [status, navigate]);

  useEffect(() => {
    setMenuIndex(0);
    setSwapIndex(0);
    setEndSelected(false);
  }, [state?.overlay]);

  useCueAudio(state);
  useBackGuard(
    useCallback(() => dispatch({ type: 'BACK', now: Date.now() }), [dispatch]),
    status === 'ready' && state?.phase !== 'done',
  );

  function stepLoad(s: SessionState, direction: 1 | -1, repeat: boolean, at: number) {
    if (repeat && at - lastStep.current < REPEAT_STEP_MS) return;
    lastStep.current = at;
    const item = currentItem(s);
    const exercise = item && library.get(item.exerciseId);
    if (!exercise || exercise.load.type === 'bodyweight') return;
    const current = s.phase === 'rest' && s.draft ? s.draft.load : s.load;
    dispatch({ type: 'SET_LOAD', load: step(current, direction, loadOptions(exercise, settings)), now: at });
  }

  function onMain(s: SessionState, action: RemoteAction, repeat: boolean, at: number) {
    if (action === 'OK') dispatch({ type: 'OK', now: at });
    else if (action === 'BACK' || action === 'PLAYPAUSE') dispatch({ type: 'BACK', now: at });
    else if (action === 'LEFT' || action === 'RIGHT') stepLoad(s, action === 'RIGHT' ? 1 : -1, repeat, at);
    else if (s.phase === 'rest') dispatch({ type: 'ADJ_REPS', delta: action === 'UP' ? 1 : -1, now: at });
  }

  function onMenu(s: SessionState, action: RemoteAction, at: number) {
    const items = menuItems(s);
    if (action === 'UP' || action === 'DOWN') setMenuIndex((i) => wrap(i + (action === 'DOWN' ? 1 : -1), items.length));
    else if (action === 'OK') dispatch({ type: 'MENU', action: items[menuIndex]?.action ?? 'resume', now: at });
    else if (action === 'BACK' || action === 'PLAYPAUSE') dispatch({ type: 'BACK', now: at });
  }

  function onSwap(action: RemoteAction, at: number) {
    const list = alternatives.data ?? [];
    if (action === 'UP' || action === 'DOWN') setSwapIndex((i) => wrap(i + (action === 'DOWN' ? 1 : -1), list.length));
    else if (action === 'OK' && list[swapIndex]) dispatch({ type: 'SWAP_APPLY', item: list[swapIndex], now: at });
    else if (action === 'BACK') dispatch({ type: 'BACK', now: at });
  }

  function onConfirm(action: RemoteAction, at: number) {
    if (action === 'LEFT' || action === 'RIGHT' || action === 'UP' || action === 'DOWN') setEndSelected((v) => !v);
    else if (action === 'OK') dispatch({ type: 'MENU', action: endSelected ? 'confirmEnd' : 'cancel', now: at });
    else if (action === 'BACK') dispatch({ type: 'BACK', now: at });
  }

  useRemoteKeys((action, { repeat }) => {
    if (!state) {
      // Loading or failed: Back is the only way out.
      if (action === 'BACK') navigate(paths.home(), { replace: true });
      return;
    }
    if (state.phase === 'done') return;
    unlockAudio();
    const at = Date.now();
    switch (state.overlay) {
      case 'none':
        return onMain(state, action, repeat, at);
      case 'menu':
        return onMenu(state, action, at);
      case 'swap':
        return onSwap(action, at);
      case 'confirmEnd':
        return onConfirm(action, at);
    }
  });

  if (status === 'error') {
    return (
      <Centered>
        <p className="font-display text-[4rem] font-semibold">Couldn’t load this workout</p>
        <p className="text-dim">{error}</p>
        <p className="text-faint">Press BACK to go home.</p>
      </Centered>
    );
  }
  if (!state) return <Centered><p className="text-dim">Loading workout…</p></Centered>;
  if (state.phase === 'done') {
    return (
      <Centered>
        <p className="font-display text-[6rem] font-bold uppercase text-good">Workout complete</p>
        <p className="text-dim">{saveStatus === 'offline' ? 'Waiting for the server to save…' : 'Saving…'}</p>
      </Centered>
    );
  }

  return (
    <>
      <PlayerView state={state} now={now} saving={saveStatus} />
      {state.overlay === 'menu' && <PauseMenu items={menuItems(state)} index={menuIndex} notice={workoutNotice(state.notice)} />}
      {state.overlay === 'swap' && <SwapPicker alternatives={alternatives.data} error={alternatives.error} index={swapIndex} />}
      {state.overlay === 'confirmEnd' && <ConfirmEnd endSelected={endSelected} />}
    </>
  );
}
