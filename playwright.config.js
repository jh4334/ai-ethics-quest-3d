import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 8_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: '.omo/evidence/task-11-playwright',
  reporter: [['line']],
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate: '{testDir}/../reboot-visual/__snapshots__/{arg}{ext}',
  testDir: './tests/reboot-e2e',
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:8899',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    locale: 'ko-KR',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    video: 'on',
    viewport: { width: 1180, height: 820 }
  },
  webServer: {
    command: 'npm run preview:test',
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:8899/reboot.html'
  },
  workers: 1
});
