import * as path from 'node:path';
import { defineConfig } from '@playwright/test';

const apiTsconfig = path.resolve(__dirname, '../api/tsconfig.json');
const e2eServerScript = path.resolve(__dirname, '../api/test/e2e-server.ts');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'ar-EG',
    viewport: { width: 1280, height: 840 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx tsx --tsconfig "${apiTsconfig}" "${e2eServerScript}"`,
    url: 'http://localhost:3000/api/v1/health',
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
