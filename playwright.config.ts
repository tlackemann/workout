import { defineConfig } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'tv-1080', use: { viewport: { width: 1920, height: 1080 } } },
    // Android TV WebViews usually report a 960×540 CSS viewport at DPR 2.
    { name: 'tv-540', use: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 }, grep: /@smoke/ },
  ],
  webServer: {
    command: `npm run build && rm -rf test-results/e2e && mkdir -p test-results/e2e && NODE_ENV=production PORT=${PORT} DB_PATH=test-results/e2e/e2e.db OVERRIDES_DIR=test-results/e2e/overrides node src/server/main.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
