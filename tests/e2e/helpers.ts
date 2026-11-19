import { expect, type Page } from '@playwright/test';

export async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

export const phase = (page: Page) => page.getByTestId('player');
export const stretchPhase = (page: Page) => page.getByTestId('stretch-player');

const HOME_LINKS = ['go-history', 'go-progress', 'go-settings'] as const;

/** From Home: ▼ past the Stretch band to the link row, then sideways onto `link`. */
export async function focusHomeLink(page: Page, link: (typeof HOME_LINKS)[number]): Promise<void> {
  const focusedLink = async () => {
    for (const [i, id] of HOME_LINKS.entries()) if ((await page.getByTestId(id).getAttribute('data-focused')) === 'true') return i;
    return -1;
  };
  for (let i = 0; i < 4 && (await focusedLink()) < 0; i++) await press(page, 'ArrowDown');
  const target = HOME_LINKS.indexOf(link);
  for (let i = 0; i < 4; i++) {
    const at = await focusedLink();
    if (at === target) break;
    await press(page, at < target ? 'ArrowRight' : 'ArrowLeft');
  }
  await expect(page.getByTestId(link)).toHaveAttribute('data-focused', 'true');
}

/** Plan + start the focused day at Quick length, using only remote keys. */
export async function startQuickWorkout(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await press(page, 'Enter');
  await expect(page.getByTestId('preview')).toBeVisible();
  await press(page, 'ArrowRight');
  await expect(page.getByTestId('length-quick')).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('length-quick')).toHaveClass(/border-text/);
  await press(page, 'ArrowLeft');
  await expect(page.getByTestId('start')).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('player')).toBeVisible();
}

/** Advance fake time in small steps (below the 15 s catch-up threshold) until the phase changes. */
export async function waitOutPhase(page: Page, from: string, stepMs = 5_000, maxSteps = 60, player = phase(page)): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if ((await player.getAttribute('data-phase')) !== from) return;
    await page.clock.fastForward(stepMs);
    await page.waitForTimeout(30);
  }
  throw new Error(`phase "${from}" never ended`);
}
