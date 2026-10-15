import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dorostudy.onboarding.v2', 'done');
    if (!localStorage.getItem('dorostudy.language')) localStorage.setItem('dorostudy.language', 'vi');
    window.googleTest = { initialized: 0, token: 0 };
    window.google = { accounts: { id: {
      initialize: config => { window.googleTest.initialized++; window.googleTest.callback = config.callback; },
      renderButton: (container, options) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = 'Google test sign in';
        button.lang = options.locale;
        button.onclick = () => window.googleTest.callback({ credential: `test-token-${++window.googleTest.token}` });
        container.appendChild(button);
      },
    } } };
  });
  await page.route(/https:\/\/[^/]*posthog\.com\//, route => route.fulfill({ json: { status: 1 } }));
  await page.route('https://accounts.google.com/**', route => route.abort());
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '' }));
});

async function mockApi(page, baseURL, state) {
  await page.route(`${baseURL}/api/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: state.signedIn ? 200 : 401, json: state.signedIn ? { id: 42, username: 'returning_user', name: 'Returning user' } : {} });
    if (path === '/api/auth/google') {
      state.googleCalls++;
      if (state.googleGate) await state.googleGate;
      if (state.googleError) return route.fulfill({ status: 400, json: { message: 'Đăng nhập Google thất bại.' } });
      state.signedIn = !state.blockCookie;
      return route.fulfill({ json: { userId: 42, username: 'returning_user' } });
    }
    if (path === '/api/auth/logout') { state.signedIn = false; state.logoutCalls++; return route.fulfill({ json: { success: true } }); }
    if (path === '/api/reflections/next-session') {
      state.planCalls++;
      if (state.planStatus) return route.fulfill({ status: state.planStatus, json: { message: 'temporary failure' } });
      return route.fulfill({ json: { headline: 'Bắt đầu một phiên trong 25 phút', durationMinutes: 25, breakMinutes: 5, predictedFocusScore: 65, timingVerdict: 'UNKNOWN', basedOnSessions: 0, reasons: [] } });
    }
    if (path === '/api/reflections') return route.fulfill({ json: [{ id: 81, summary: 'Try a smaller goal.', recommendation: 'Study for 15 minutes.', aiAvailable: true }] });
    return route.fulfill({ json: path === '/api/nudges/config' ? { enabled: false, subscribed: false } : {} });
  });
}

for (const status of [401, 403]) test(`pausing with a ${status} coach response preserves the timer and login UI`, async ({ page, baseURL }) => {
  const state = { signedIn: true, googleCalls: 0, planCalls: 0, logoutCalls: 0 };
  await mockApi(page, baseURL, state);
  await page.goto('/');
  await expect.poll(() => state.planCalls).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click();
  await page.waitForTimeout(1100);
  state.planStatus = status;
  const before = state.planCalls;
  await page.getByRole('button', { name: 'Tạm dừng đồng hồ' }).click();
  await expect.poll(() => state.planCalls).toBeGreaterThan(before);
  await expect(page).toHaveURL(baseURL + '/');
  const paused = await page.locator('.time').innerText();
  await page.waitForTimeout(1100);
  await expect(page.locator('.time')).toHaveText(paused);
  await page.getByRole('button', { name: 'Menu tài khoản' }).click();
  await expect(page.getByText('Returning user', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng xuất/ })).toBeVisible();
  expect(state.logoutCalls).toBe(0);
});

test('changing language during Google verification keeps retry usable', async ({ page, baseURL }) => {
  let release;
  const state = { signedIn: false, googleCalls: 0, logoutCalls: 0, planCalls: 0, googleError: true,
    googleGate: new Promise(resolve => { release = resolve; }) };
  await mockApi(page, baseURL, state);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect.poll(() => state.googleCalls).toBe(1);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  release();
  await expect(page.locator('.error-message')).toHaveText('Google sign-in failed.');
  await expect(page.getByRole('button', { name: 'Google test sign in' })).toBeVisible();
  expect(await page.evaluate(() => window.googleTest.initialized)).toBe(1);
  state.googleError = false;
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect(page).toHaveURL(baseURL + '/');
});

test('Google failure can be retried; successful cookie verification permits a later sign-in', async ({ page, baseURL }) => {
  const state = { signedIn: false, googleCalls: 0, logoutCalls: 0, planCalls: 0, googleError: true };
  await mockApi(page, baseURL, state);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect(page.locator('.error-message')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google test sign in' })).toBeVisible();
  // Typing causes parent renders. GSI must remain initialized once.
  await page.getByPlaceholder('Tên đăng nhập hoặc email').fill('someone');
  expect(await page.evaluate(() => window.googleTest.initialized)).toBe(1);
  state.googleError = false; state.blockCookie = true;
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect(page.locator('.error-message')).toContainText('không lưu được phiên');
  await expect(page).toHaveURL(baseURL + '/login');
  state.blockCookie = false;
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect(page).toHaveURL(baseURL + '/');
  await page.getByRole('button', { name: 'Menu tài khoản' }).click();
  await page.getByRole('button', { name: /Đăng xuất/ }).click();
  await expect(page).toHaveURL(baseURL + '/login');
  await page.getByRole('button', { name: 'Google test sign in' }).click();
  await expect(page).toHaveURL(baseURL + '/');
  await page.getByRole('button', { name: 'Menu tài khoản' }).click();
  await expect(page.getByText('Returning user', { exact: true })).toBeVisible();
  expect(state.googleCalls).toBe(4);
});

test('language is visible, preserves a running timer, and synchronizes English feedback', async ({ page, baseURL }, testInfo) => {
  const state = { signedIn: true, googleCalls: 0, logoutCalls: 0, planCalls: 0 };
  await mockApi(page, baseURL, state);
  await page.goto('/');
  const english = page.getByRole('button', { name: 'English', exact: true });
  await expect(english).toBeInViewport();
  await page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click();
  await english.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('What are you focusing on?')).toBeVisible();
  await page.getByRole('button', { name: 'Product feedback', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Help make every session better' })).toBeVisible();
  await expect(page.locator('#df-area option[value="timer"]')).toHaveText('Timer / pausing / breaks');
  await page.locator('#df-comment').fill('Please make the pause button easier to find.');
  await page.locator('#df-area').selectOption('timer');
  await page.locator('#df-issue').selectOption('hard_to_use');
  const payloadPromise = page.waitForRequest(request => request.url().includes('/i/v0/e/') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  const payload = (await payloadPromise).postDataJSON();
  expect(payload.properties).toMatchObject({ language: 'en', area: 'timer', issue_type: 'hard_to_use', feedback_comment: 'Please make the pause button easier to find.' });
  await expect(page.getByRole('heading', { name: 'Thank you for sharing!' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to studying' }).click();
  await page.screenshot({ path: testInfo.outputPath('english-timer.png') });
  await page.reload();
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
});
