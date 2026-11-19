import { useEffect } from 'react';
import { Centered } from '../components/Screen.tsx';
import { FocusButton } from '../components/FocusButton.tsx';
import { useRemoteKeys } from '../input/useRemoteKeys.ts';
import { resumeOnVisible } from '../audio/cues.ts';
import { History } from '../screens/History.tsx';
import { Home } from '../screens/Home.tsx';
import { Player } from '../screens/player/Player.tsx';
import { Preview } from '../screens/Preview.tsx';
import { Progress } from '../screens/progress/Progress.tsx';
import { Settings } from '../screens/Settings.tsx';
import { StretchDone } from '../screens/stretch/StretchDone.tsx';
import { StretchPlayer } from '../screens/stretch/StretchPlayer.tsx';
import { StretchPreview } from '../screens/stretch/StretchPreview.tsx';
import { Summary } from '../screens/Summary.tsx';
import { api } from './api.ts';
import { AppDataProvider } from './AppData.tsx';
import { RouterProvider, useRouter } from './router.tsx';
import { paths } from './routes.ts';
import { useAsync } from './useAsync.ts';

function Routes() {
  const { route, navigate } = useRouter();

  // Desktop/keyboard Back (Escape/Backspace). On the TV, Back usually arrives as a history pop.
  // The players own Back themselves (it opens their pause menu).
  useRemoteKeys((action) => {
    if (action === 'BACK' && route.name !== 'home') window.history.back();
  }, route.name !== 'play' && route.name !== 'stretchPlay');

  switch (route.name) {
    case 'home':
      return <Home />;
    case 'preview':
      return <Preview key={route.id} id={route.id} />;
    case 'play':
      return <Player key={route.id} id={route.id} />;
    case 'summary':
      return <Summary key={route.id} id={route.id} />;
    case 'stretchPreview':
      return <StretchPreview key={route.id} id={route.id} />;
    case 'stretchPlay':
      return <StretchPlayer key={route.id} id={route.id} />;
    case 'stretchDone':
      return <StretchDone key={route.id} id={route.id} />;
    case 'settings':
      return <Settings />;
    case 'history':
      return <History />;
    case 'progress':
      // No key: switching tabs must not remount (and refetch) the screen.
      return <Progress tab={route.tab} />;
    case 'notFound':
      return (
        <Centered>
          <p className="text-dim">That page doesn’t exist.</p>
          <FocusButton autoFocus onPress={() => navigate(paths.home(), { replace: true })} className="rounded-2xl bg-surface-2 px-10 py-4">
            Go home
          </FocusButton>
        </Centered>
      );
  }
}

export function App() {
  const boot = useAsync(() => Promise.all([api.settings(), api.prefs()]), []);
  useEffect(() => resumeOnVisible(), []);

  if (boot.error) {
    return (
      <Centered>
        <p className="font-display text-[4rem] font-semibold">Can’t reach the gym server</p>
        <p className="text-dim">{boot.error}</p>
        <FocusButton autoFocus onPress={boot.reload} className="rounded-2xl bg-surface-2 px-10 py-4" testId="retry">
          Try again
        </FocusButton>
      </Centered>
    );
  }
  if (!boot.data) {
    return (
      <Centered>
        <p className="text-dim">Loading…</p>
      </Centered>
    );
  }
  const [settings, prefs] = boot.data;
  return (
    <AppDataProvider initial={{ settings, prefs }}>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </AppDataProvider>
  );
}
