import { defineConfig } from '@playwright/test';
import { contextSettings, screenshotSettings } from './visual.settings.js';

export default defineConfig({
  testDir: './tests',
  testMatch: 'visual.spec.js',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}-{platform}/{arg}{ext}',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      ...screenshotSettings,
      threshold: 0.1,
      maxDiffPixels: 0,
    },
  },
  use: {
    ...contextSettings,
    headless: true,
    trace: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
