import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: { locale: 'vi-VN', baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4175', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'compact', use: { viewport: { width: 320, height: 568 } } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    env: {
      VITE_POSTHOG_ENABLED: 'true', VITE_POSTHOG_KEY: 'phc_dorostudy_e2e', VITE_POSTHOG_HOST: 'https://us.i.posthog.com',
      VITE_POSTHOG_REFLECTION_SURVEY_ID: '51ce5223-155e-4dcb-a8c2-890596d1c001',
      VITE_POSTHOG_UX_SURVEY_ID: '51ce5223-155e-4dcb-a8c2-890596d1c002',
    },
  },
});
