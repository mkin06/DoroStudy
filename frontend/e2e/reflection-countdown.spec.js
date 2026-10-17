import { expect, test as base } from '@playwright/test';

const test = base.extend({
  reflectionLanguage: ['vi', { option: true }],
  reflection: async ({ page, baseURL, reflectionLanguage }, use) => {
    const submissions = [];
    const errors = [];
    const state = { failNext: false };
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(language => {
      try {
        localStorage.setItem('dorostudy.language', language);
        localStorage.setItem('dorostudy.onboarding.v2', 'done');
        localStorage.setItem('dorostudy.pendingReflection', JSON.stringify({ sessionId: 71, userId: 101 }));
      } catch { /* Third-party frames can have no storage. */ }
    }, reflectionLanguage);
    // Production runs also intercept every API write and analytics request.
    await page.route(/https:\/\/[^/]*posthog\.com\//, route => route.fulfill({ json: {} }));
    await page.route('https://accounts.google.com/**', route => route.abort());
    await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '' }));
    await page.route(`${baseURL}/api/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/reflections' && route.request().method() === 'POST') {
        submissions.push(route.request().postDataJSON());
        if (state.failNext) {
          state.failNext = false;
          return route.fulfill({ status: 503, json: { message: 'Có lỗi xảy ra, vui lòng thử lại.' } });
        }
        return route.fulfill({ json: { id: 81, sessionId: 71, focusScore: 82, source: 'gemini', summary: 'Session recorded.', recommendation: 'Try a short session.' } });
      }
      return route.fulfill({ json: path === '/api/auth/me' ? { id: 101, username: 'countdown_test' }
        : path === '/api/nudges/config' ? { enabled: false, subscribed: false } : null });
    });
    await page.clock.install({ time: new Date('2026-10-17T09:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T09:00:01Z'));
    await page.goto('/');
    await expect(page.locator('#reflection-completion')).toBeVisible();
    await use({ submissions, state });
    expect(errors).toEqual([]);
  },
});

test('an untouched survey waits indefinitely, including focus and unrelated clicks', async ({ page, reflection }, testInfo) => {
  await page.locator('.reflection-title').click();
  await page.locator('#reflection-completion').focus();
  await page.locator('.reflection-emoji[title="Tốt"]').click();
  await page.clock.fastForward(60000);
  await expect(page.locator('#reflection-completion')).toBeVisible();
  await expect(page.locator('.reflection-subtitle')).toHaveText('Chọn mức hoàn thành ở câu đầu tiên để bắt đầu đếm ngược 15 giây.');
  expect(await page.locator('.reflection-countdown-bar').evaluate(el => el.style.width)).toBe('100%');
  expect(reflection.submissions).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('waiting-for-first-answer.png') });
});

test('clicking the first answer starts once; later answers do not reset the countdown', async ({ page, reflection }) => {
  await page.locator('#reflection-completion').click();
  await expect(page.locator('.reflection-subtitle')).toContainText('15s');
  await page.clock.runFor(5000);
  await expect(page.locator('.reflection-subtitle')).toContainText('10s');
  await page.locator('.reflection-emoji[title="Tốt"]').click();
  await page.locator('.reflection-energy[title="4/5"]').click();
  await page.getByRole('radio', { name: '🔊 Tiếng ồn', exact: true }).click();
  await page.locator('#reflection-completion').click();
  await page.clock.runFor(9000);
  await expect(page.locator('.reflection-subtitle')).toContainText('1s');
  expect(reflection.submissions).toHaveLength(0);
  await page.clock.runFor(1000);
  await expect(page.locator('.reflection-result')).toBeVisible();
  expect(reflection.submissions).toHaveLength(1);
  expect(reflection.submissions[0]).toMatchObject({ sessionId: 71, focusLevel: 4, energyLevel: 4, distractionReasons: ['noise'] });
  await page.clock.fastForward(20000);
  expect(reflection.submissions).toHaveLength(1);
});

test('keyboard answering starts the countdown and hiding the tab pauses it', async ({ page, reflection }) => {
  await page.locator('#reflection-completion').press('ArrowRight');
  await page.locator('.reflection-emoji[title="Tốt"]').click();
  await page.clock.runFor(4000);
  await expect(page.locator('.reflection-subtitle')).toContainText('11s');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(30000);
  await expect(page.locator('.reflection-subtitle')).toContainText('11s');
  expect(reflection.submissions).toHaveLength(0);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(11000);
  await expect(page.locator('.reflection-result')).toBeVisible();
  expect(reflection.submissions).toHaveLength(1);
});

test('failed auto submission leaves answers for retry without an automatic request loop', async ({ page, reflection }) => {
  reflection.state.failNext = true;
  await page.locator('#reflection-completion').press('End');
  await page.locator('.reflection-emoji[title="Rất tập trung"]').click();
  await page.clock.runFor(15000);
  await expect(page.locator('.reflection-error')).toBeVisible();
  await expect(page.locator('#reflection-completion')).toHaveValue('100');
  await page.clock.fastForward(30000);
  expect(reflection.submissions).toHaveLength(1);
  await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
  await expect(page.locator('.reflection-result')).toBeVisible();
  expect(reflection.submissions).toHaveLength(2);
});

test.describe('English survey', () => {
  test.use({ reflectionLanguage: 'en' });
  test('waiting instructions and the active countdown follow the selected language', async ({ page, reflection }) => {
    await expect(page.locator('.reflection-subtitle')).toHaveText('Choose your completion level in the first question to start the 15-second countdown.');
    await page.locator('#reflection-completion').press('ArrowLeft');
    await page.clock.runFor(1000);
    await expect(page.locator('.reflection-subtitle')).toHaveText('15 seconds to help AI understand your session — 14s remaining');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.locator('.reflection-backdrop')).toHaveCount(0);
    await page.clock.fastForward(30000);
    expect(reflection.submissions).toHaveLength(0);
  });
});
