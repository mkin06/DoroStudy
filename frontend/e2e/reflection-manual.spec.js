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
        if (!sessionStorage.getItem('manual-reflection-closed')) {
          localStorage.setItem('dorostudy.pendingReflection', JSON.stringify({ sessionId: 71, userId: 101 }));
        }
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
      return route.fulfill({ json: path === '/api/auth/me' ? { id: 101, username: 'reflection_test' }
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

test('the survey stays open without a time limit or countdown', async ({ page, reflection }) => {
  await page.clock.fastForward(120000);
  await expect(page.locator('.reflection-subtitle')).toHaveText('Trả lời theo thời gian của bạn. Bấm X để đóng hoặc Xem kết quả để gửi.');
  await expect(page.locator('.reflection-countdown')).toHaveCount(0);
  expect(reflection.submissions).toHaveLength(0);
});

test('completed answers wait for explicit submission, including after switching tabs', async ({ page, reflection }, testInfo) => {
  await page.locator('#reflection-completion').press('End');
  await page.locator('.reflection-emoji[title="Tốt"]').click();
  await page.locator('.reflection-energy[title="4/5"]').click();
  await page.getByRole('radio', { name: '🔊 Tiếng ồn', exact: true }).click();
  await page.clock.runFor(16000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120000);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#reflection-completion')).toHaveValue('100');
  expect(reflection.submissions).toHaveLength(0);
  await page.locator('.reflection-close').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('manual-survey.png') });
  await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
  await expect(page.locator('.reflection-result')).toBeVisible();
  expect(reflection.submissions).toHaveLength(1);
  expect(reflection.submissions[0]).toMatchObject({ sessionId: 71, completionPercent: 100, focusLevel: 4, energyLevel: 4, distractionReasons: ['noise'] });
});

test('X closes the answered survey without sending it, and reload does not reopen it', async ({ page, reflection }) => {
  await page.locator('#reflection-completion').press('ArrowRight');
  await page.locator('.reflection-emoji[title="Tốt"]').click();
  const close = page.locator('.reflection-close');
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
  await expect(page.locator('.reflection-backdrop')).toHaveCount(0);
  await page.clock.fastForward(120000);
  expect(reflection.submissions).toHaveLength(0);
  // Disable the fixture's initial pending-session seed before testing a real reload.
  await page.evaluate(() => { window.sessionStorage.setItem('manual-reflection-closed', 'true'); });
  await page.reload();
  await expect(page.locator('.timer-content')).toBeVisible();
  await expect(page.locator('.reflection-backdrop')).toHaveCount(0);
});

test('failed manual submission keeps answers until the user retries', async ({ page, reflection }) => {
  reflection.state.failNext = true;
  await page.locator('#reflection-completion').press('End');
  await page.locator('.reflection-emoji[title="Rất tập trung"]').click();
  await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
  await expect(page.locator('.reflection-error')).toBeVisible();
  await expect(page.locator('#reflection-completion')).toHaveValue('100');
  await page.clock.fastForward(120000);
  expect(reflection.submissions).toHaveLength(1);
  await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
  await expect(page.locator('.reflection-result')).toBeVisible();
  expect(reflection.submissions).toHaveLength(2);
});

test.describe('English survey', () => {
  test.use({ reflectionLanguage: 'en' });
  test('English instructions explain manual submission and X closes without sending', async ({ page, reflection }) => {
    await expect(page.locator('.reflection-subtitle')).toHaveText('Take your time. Click X to close or See reflection to submit.');
    await expect(page.getByRole('button', { name: 'See reflection', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('.reflection-backdrop')).toHaveCount(0);
    expect(reflection.submissions).toHaveLength(0);
  });
});

