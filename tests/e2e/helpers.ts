import { expect, type Page } from '@playwright/test';

export async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

export const phase = (page: Page) => page.getByTestId('player');

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
export async function waitOutPhase(page: Page, from: string, stepMs = 5_000, maxSteps = 60): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if ((await phase(page).getAttribute('data-phase')) !== from) return;
    await page.clock.fastForward(stepMs);
    await page.waitForTimeout(30);
  }
  throw new Error(`phase "${from}" never ended`);
}
