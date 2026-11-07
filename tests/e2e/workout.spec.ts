import { expect, test } from '@playwright/test';
import { phase, press, startQuickWorkout, waitOutPhase } from './helpers.ts';

test.describe.configure({ mode: 'serial' });

test('home and settings render inside the TV viewport @smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  for (const day of ['push', 'pull', 'legs']) await expect(page.getByTestId(`day-${day}`)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto('/settings');
  await expect(page.getByTestId('settings')).toBeVisible();
});

test('picks a day and edits the plan with only the remote', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('day-push')).toHaveAttribute('data-focused', 'true');
  await press(page, 'ArrowRight');
  await expect(page.getByTestId('day-pull')).toHaveAttribute('data-focused', 'true');
  await press(page, 'ArrowLeft');
  await press(page, 'Enter');
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByTestId('start')).toHaveAttribute('data-focused', 'true');

  // Open the options sheet on the second exercise, then close it with the TV's Back (history pop).
  await press(page, 'ArrowDown', 2);
  await press(page, 'Enter');
  await expect(page.getByTestId('item-sheet')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('item-sheet')).toBeHidden();
  await expect(page.getByTestId('preview')).toBeVisible();

  // Swap it for the first alternative.
  const before = await page.locator('[data-testid^="row-"]').nth(1).getAttribute('data-testid');
  await press(page, 'Enter');
  await expect(page.getByTestId('action-swap')).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('swap-sheet')).toBeVisible();
  await expect(page.locator('[data-testid^="alt-"]').first()).toHaveAttribute('data-focused', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('swap-sheet')).toBeHidden();
  const after = await page.locator('[data-testid^="row-"]').nth(1).getAttribute('data-testid');
  expect(after).not.toBe(before);

  // Escape (keyboard Back) returns home.
  await press(page, 'Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('runs a full session with automatic timers and shows the summary', async ({ page }) => {
  await page.clock.install();
  await startQuickWorkout(page);
  await expect(page.getByTestId('phase-label')).toHaveText('Get ready');

  // Get-ready countdown starts the first set by itself.
  await waitOutPhase(page, 'intro', 2_000);
  await expect(phase(page)).toHaveAttribute('data-phase', 'work');

  // OK = set done → rest, with the log pre-filled; ▼ records a missed rep.
  await press(page, 'Enter');
  await expect(phase(page)).toHaveAttribute('data-phase', 'rest');
  const target = Number(await page.getByTestId('log-reps').textContent());
  await press(page, 'ArrowDown');
  await expect(page.getByTestId('log-reps')).toHaveText(String(target - 1));

  // Rest runs out on its own and the next set starts.
  await waitOutPhase(page, 'rest');
  await expect(phase(page)).toHaveAttribute('data-phase', 'work');

  // Finish the rest of the workout: OK ends each set, OK skips each rest.
  for (let i = 0; i < 120 && !(await page.getByTestId('summary').isVisible()); i++) {
    await press(page, 'Enter');
    await page.clock.fastForward(500);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByText('Workout complete')).toBeVisible();
  await expect(page.getByTestId('summary-list')).toContainText('Next:');

  await press(page, 'Enter');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('survives Back, reloads and long absences, and can end early', async ({ page }) => {
  await page.clock.install();
  await startQuickWorkout(page);

  // Two TV Backs straight after starting (no other key yet): pause, then resume. Never leave.
  await page.goBack();
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('pause-menu')).toBeHidden();
  await expect(page.getByTestId('player')).toBeVisible();

  await press(page, 'Enter'); // skip get-ready
  await expect(phase(page)).toHaveAttribute('data-phase', 'work');

  // The TV Back button arrives as a history pop: it must open the pause menu, not leave.
  const url = page.url();
  await page.goBack();
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  expect(page.url()).toBe(url);
  await press(page, 'Enter'); // Resume (focused first)
  await expect(page.getByTestId('pause-menu')).toBeHidden();

  // Reload mid-rest → restored, paused, with a welcome-back notice.
  await press(page, 'Enter');
  await expect(phase(page)).toHaveAttribute('data-phase', 'rest');
  await page.waitForTimeout(600); // let the debounced save land
  await page.reload();
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await expect(page.getByText('Welcome back')).toBeVisible();
  await press(page, 'Escape'); // Back resumes
  await expect(page.getByTestId('pause-menu')).toBeHidden();

  // Walk away for 10 minutes: one phase advances, then it pauses.
  await page.clock.fastForward(10 * 60_000);
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await expect(page.getByText('Paused while you were away')).toBeVisible();
  await expect(phase(page)).toHaveAttribute('data-phase', 'work');

  // End workout from the menu (confirmation defaults to "Keep going").
  await press(page, 'ArrowUp'); // wraps to the last item: End workout
  await expect(page.getByTestId('menu-end')).toHaveAttribute('data-selected', 'true');
  await press(page, 'Enter');
  await expect(page.getByTestId('confirm-end')).toBeVisible();
  await expect(page.getByTestId('confirm-cancel')).toHaveAttribute('data-selected', 'true');
  await press(page, 'ArrowRight');
  await press(page, 'Enter');
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByText('Ended early')).toBeVisible();
});

test('settings work by touch and persist', async ({ page }) => {
  await page.goto('/settings');
  const dumbbells = page.getByTestId('equip-dumbbells');
  await expect(dumbbells).toContainText('Off');
  await dumbbells.click();
  await expect(dumbbells).toContainText('On');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId('equip-dumbbells')).toContainText('On');
});
