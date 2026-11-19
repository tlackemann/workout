export const PROGRESS_TABS = ['lifts', 'consistency', 'sessions', 'muscles'] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number];

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'preview'; readonly id: string }
  | { readonly name: 'play'; readonly id: string }
  | { readonly name: 'summary'; readonly id: string }
  | { readonly name: 'stretchPreview'; readonly id: string }
  | { readonly name: 'stretchPlay'; readonly id: string }
  | { readonly name: 'stretchDone'; readonly id: string }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'progress'; readonly tab: ProgressTab }
  | { readonly name: 'notFound' };

const WITH_ID = /^\/(preview|play|summary)\/([A-Za-z0-9-]{1,64})\/?$/;
const PROGRESS = /^\/progress(?:\/([a-z]+))?\/?$/;
const STRETCH = /^\/stretch\/([A-Za-z0-9-]{1,64})(?:\/(play|done))?\/?$/;
const STRETCH_ROUTES = { preview: 'stretchPreview', play: 'stretchPlay', done: 'stretchDone' } as const;

const isProgressTab = (value: string): value is ProgressTab => (PROGRESS_TABS as readonly string[]).includes(value);

export function matchRoute(path: string): Route {
  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/history') return { name: 'history' };
  const progress = PROGRESS.exec(path);
  if (progress) {
    const tab = progress[1] ?? 'lifts';
    return isProgressTab(tab) ? { name: 'progress', tab } : { name: 'notFound' };
  }
  const stretch = STRETCH.exec(path);
  if (stretch) return { name: STRETCH_ROUTES[(stretch[2] as 'play' | 'done' | undefined) ?? 'preview'], id: stretch[1]! };
  const m = WITH_ID.exec(path);
  if (m) return { name: m[1] as 'preview' | 'play' | 'summary', id: m[2]! };
  return { name: 'notFound' };
}

export const paths = {
  home: () => '/',
  preview: (id: string) => `/preview/${id}`,
  play: (id: string) => `/play/${id}`,
  summary: (id: string) => `/summary/${id}`,
  stretchPreview: (id: string) => `/stretch/${id}`,
  stretchPlay: (id: string) => `/stretch/${id}/play`,
  stretchDone: (id: string) => `/stretch/${id}/done`,
  settings: () => '/settings',
  history: () => '/history',
  progress: (tab: ProgressTab = 'lifts') => (tab === 'lifts' ? '/progress' : `/progress/${tab}`),
};
