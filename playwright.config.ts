import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const E2E_DATA_DIR = join(tmpdir(), 'company-trello-e2e');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start -w server',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: '3000',
      DATA_DIR: E2E_DATA_DIR,
      NODE_ENV: 'production',
      SESSION_SECRET: 'e2e-test-secret',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'admin-password-123',
      APP_URL: 'http://localhost:3000',
    },
  },
});
