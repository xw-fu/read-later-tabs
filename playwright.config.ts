import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { headless: true },
  webServer: {
    command: 'npm run build',
    port: 0,
    reuseExistingServer: false,
    stdout: 'ignore',
  },
});
