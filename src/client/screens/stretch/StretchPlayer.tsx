import { pause as pauseNavigation, resume as resumeNavigation } from '@noriginmedia/norigin-spatial-navigation';
import { useCallback, useEffect, useState } from 'react';
import type { StretchState } from '../../../core/stretch/state.ts';
import type { StretchSessionDto } from '../../app/api.ts';
import { useRouter } from '../../app/router.tsx';
import { paths } from '../../app/routes.ts';
import { unlockAudio } from '../../audio/cues.ts';
import { Centered } from '../../components/Screen.tsx';
import type { RemoteAction } from '../../input/keymap.ts';
import { useRemoteKeys } from '../../input/useRemoteKeys.ts';
import { ConfirmEnd, PauseMenu } from '../player/Overlays.tsx';
import { useBackGuard } from '../player/useBackGuard.ts';
import { STRETCH_END_COPY, stretchMenuItems, stretchNotice } from './stretchMenu.ts';
import { StretchView } from './StretchView.tsx';
import { useStretchCues } from './useStretchCues.ts';
import { useStretchSession } from './useStretchSession.ts';

const wrap = (i: number, n: number) => (n === 0 ? 0 : (i + n) % n);
const FINISHED = ['completed', 'ended_early'];

export function StretchPlayer(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const onFinished = useCallback(
    (dto: StretchSessionDto) => navigate(FINISHED.includes(dto.status) ? paths.stretchDone(dto.id) : paths.home(), { replace: true }),
    [navigate],
  );
  const { state, dispatch, status, error, saveStatus, now } = useStretchSession(props.id, onFinished);
  const [menuIndex, setMenuIndex] = useState(0);
  const [endSelected, setEndSelected] = useState(false);

  useEffect(() => {
    pauseNavigation();
    return () => resumeNavigation();
  }, []);

  useEffect(() => {
    if (status === 'gone') navigate(paths.home(), { replace: true });
  }, [status, navigate]);

  useEffect(() => {
    setMenuIndex(0);
    setEndSelected(false);
  }, [state?.overlay]);

  useStretchCues(state);
  useBackGuard(
    useCallback(() => dispatch({ type: 'BACK', now: Date.now() }), [dispatch]),
    status === 'ready' && state?.phase !== 'done',
  );

  function onMenu(s: StretchState, action: RemoteAction, at: number) {
    const items = stretchMenuItems(s);
    if (action === 'UP' || action === 'DOWN') setMenuIndex((i) => wrap(i + (action === 'DOWN' ? 1 : -1), items.length));
    else if (action === 'OK') dispatch({ type: 'MENU', action: items[menuIndex]?.action ?? 'resume', now: at });
    else if (action === 'BACK' || action === 'PLAYPAUSE') dispatch({ type: 'BACK', now: at });
  }

  function onConfirm(action: RemoteAction, at: number) {
    if (action === 'LEFT' || action === 'RIGHT' || action === 'UP' || action === 'DOWN') setEndSelected((v) => !v);
    else if (action === 'OK') dispatch({ type: 'MENU', action: endSelected ? 'confirmEnd' : 'cancel', now: at });
    else if (action === 'BACK') dispatch({ type: 'BACK', now: at });
  }

  useRemoteKeys((action) => {
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
        if (action === 'OK') dispatch({ type: 'OK', now: at });
        else if (action === 'BACK' || action === 'PLAYPAUSE') dispatch({ type: 'BACK', now: at });
        return;
      case 'menu':
        return onMenu(state, action, at);
      case 'confirmEnd':
        return onConfirm(action, at);
    }
  });

  if (status === 'error') {
    return (
      <Centered>
        <p className="font-display text-[4rem] font-semibold">Couldn’t load this stretch session</p>
        <p className="text-dim">{error}</p>
        <p className="text-faint">Press BACK to go home.</p>
      </Centered>
    );
  }
  if (!state) return <Centered><p className="text-dim">Loading stretches…</p></Centered>;
  if (state.phase === 'done') {
    return (
      <Centered>
        <p className="font-display text-[6rem] font-bold uppercase text-stretch">Stretch complete</p>
        <p className="text-dim">{saveStatus === 'offline' ? 'Waiting for the server to save…' : 'Saving…'}</p>
      </Centered>
    );
  }

  return (
    <>
      <StretchView state={state} now={now} offline={saveStatus === 'offline'} />
      {state.overlay === 'menu' && <PauseMenu items={stretchMenuItems(state)} index={menuIndex} notice={stretchNotice(state.notice)} />}
      {state.overlay === 'confirmEnd' && <ConfirmEnd endSelected={endSelected} copy={STRETCH_END_COPY} />}
    </>
  );
}
