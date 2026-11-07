export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'preview'; readonly id: string }
  | { readonly name: 'play'; readonly id: string }
  | { readonly name: 'summary'; readonly id: string }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'notFound' };

const WITH_ID = /^\/(preview|play|summary)\/([A-Za-z0-9-]{1,64})\/?$/;

export function matchRoute(path: string): Route {
  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/history') return { name: 'history' };
  const m = WITH_ID.exec(path);
  if (m) return { name: m[1] as 'preview' | 'play' | 'summary', id: m[2]! };
  return { name: 'notFound' };
}

export const paths = {
  home: () => '/',
  preview: (id: string) => `/preview/${id}`,
  play: (id: string) => `/play/${id}`,
  summary: (id: string) => `/summary/${id}`,
  settings: () => '/settings',
  history: () => '/history',
};
