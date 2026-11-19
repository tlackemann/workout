import { expect, test } from '@playwright/test';
import { focusHomeLink, press, stretchPhase, waitOutPhase } from './helpers.ts';

test.describe.configure({ mode: 'serial' });

test('runs a guided stretch session with only the remote, then removes it from History @smoke', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();

  // ▼ from the day tiles reaches the Stretch band; it's never "Next up".
  await expect(page.getByTestId('stretch-band')).not.toHaveAttribute('data-focused', 'true');
  await press(page, 'ArrowDown');
  await expect(page.getByTestId('stretch-band')).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');

  // Preview: pick Quick, then Start.
  await expect(page.getByTestId('stretch-preview')).toBeVisible();
  await expect(page.getByTestId('stretch-start')).toHaveAttribute('data-focused', 'true');
  await press(page, 'ArrowRight');
  await expect(page.getByTestId('stretch-length-quick')).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('stretch-length-quick')).toHaveClass(/border-text/);
  await press(page, 'ArrowLeft');
  await press(page, 'Enter');

  // Get into position, then the hold starts by itself.
  const player = stretchPhase(page);
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('data-phase', 'setup');
  await expect(page.getByTestId('phase-label')).toHaveText('Get into position');
  const [x, y] = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  expect(x).toBeLessThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(0);
  await waitOutPhase(page, 'setup', 2_000, 60, player);
  await expect(player).toHaveAttribute('data-phase', 'hold');

  // OK moves on early; keep going until a per-side stretch switches sides.
  for (let i = 0; i < 20 && (await page.getByTestId('phase-label').textContent()) !== 'Switch sides'; i++) await press(page, 'Enter');
  await expect(page.getByTestId('phase-label')).toHaveText('Switch sides');
  await expect(page.getByTestId('side')).toHaveText('Second side');

  // Back opens the menu (and doesn't leave the page); End asks first.
  await press(page, 'Escape');
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await expect(player).toBeVisible();
  await press(page, 'ArrowUp');
  await expect(page.getByTestId('menu-end')).toHaveAttribute('data-selected', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('confirm-cancel')).toHaveAttribute('data-selected', 'true');
  await press(page, 'ArrowRight');
  await press(page, 'Enter');

  await expect(page.getByTestId('stretch-done')).toBeVisible();
  await expect(page.getByText('Ended early')).toBeVisible();
  await press(page, 'Enter');
  await expect(page.getByTestId('home')).toBeVisible();

  // History lists it among the workouts; delete it (the e2e database is shared between runs).
  await focusHomeLink(page, 'go-history');
  await press(page, 'Enter');
  await expect(page.getByTestId('history')).toBeVisible();
  const row = page.locator('[data-testid^="stretch-session-"]').first();
  await expect(row).toBeVisible();
  for (let i = 0; i < 40 && (await row.getAttribute('data-focused')) !== 'true'; i++) await press(page, 'ArrowDown');
  await expect(row).toHaveAttribute('data-focused', 'true');
  const id = (await row.getAttribute('data-testid'))!.replace('stretch-session-', '');
  await press(page, 'ArrowRight');
  await expect(page.getByTestId(`delete-stretch-${id}`)).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('confirm-delete')).toContainText('lifting progress');
  await press(page, 'ArrowRight');
  await press(page, 'Enter');
  await expect(page.getByTestId(`stretch-session-${id}`)).toHaveCount(0);
});
