import { expect, test as base } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

// Exercise the real SDK while preventing all uploads to a real PostHog project.
function decodePayload(request) {
  let data = request.postDataBuffer();
  if (!data?.length) return null;
  if (data[0] === 0x1f && data[1] === 0x8b) data = gunzipSync(data);
  let text = data.toString('utf8');
  if (text.startsWith('data=')) {
    text = new URLSearchParams(text).get('data');
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      text = Buffer.from(text, 'base64').toString('utf8');
    }
  }
  return JSON.parse(text);
}

const test = base.extend({
  analytics: [async ({ page, baseURL }, use) => {
    const events = [];
    const payloads = [];
    const decodeErrors = [];
    const runtimeErrors = [];
    let signedIn = true;
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('dorostudy.onboarding.v2', 'done');
      // PostHog intentionally excludes automation. Override only this isolated test context.
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({ brands: [{ brand: 'Chromium', version: '130' }], mobile: false, platform: 'Windows' }),
      });
    });
    await page.route(/https:\/\/[^/]*posthog\.com\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'POST') {
        try {
          const payload = decodePayload(request);
          if (payload) {
            payloads.push(payload);
            if (/\/(e|capture|batch)\/?$/.test(url.pathname)) {
              events.push(...(Array.isArray(payload) ? payload : payload.batch || [payload]).filter((item) => item.event));
            }
          }
        } catch { decodeErrors.push('Unable to decode a PostHog POST payload'); }
      }
      const script = url.pathname.endsWith('.js');
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        contentType: script ? 'application/javascript' : 'application/json',
        body: script ? '' : JSON.stringify({
          status: 1, autocapture_opt_out: false, supportedCompression: ['gzip-js'],
          hasFeatureFlags: false, featureFlags: {}, featureFlagPayloads: {}, flags: {},
          sessionRecording: false, surveys: [],
        }),
      });
    });
    await page.route(`${baseURL}/api/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/logout') signedIn = false;
      if (path === '/api/auth/me' && !signedIn) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
        return;
      }
      const body = path === '/api/auth/me'
        ? { id: 101, name: 'private_profile_marker', username: 'private_username_marker', email: 'private_email_marker@example.test' }
        : path === '/api/reflections/next-session'
          ? { headline: 'Một phiên ngắn để bắt đầu', predictedFocusScore: 72, timingVerdict: 'UNKNOWN', durationMinutes: 25, breakMinutes: 5, personalized: false, basedOnSessions: 0, reasons: [] }
          : path === '/api/nudges/config' ? { enabled: false, subscribed: false } : {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('https://accounts.google.com/**', (route) => route.abort());
    await use({ events, payloads, decodeErrors, runtimeErrors, expireSession: () => { signedIn = false; } });
    expect(decodeErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  }, { auto: true }],
});

test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });

async function waitForEvent(analytics, name) {
  await expect.poll(() => analytics.events.some((event) => event.event === name), { timeout: 12_000 }).toBeTruthy();
  return analytics.events.find((event) => event.event === name);
}

test('identifies users and captures timer actions without task or profile content', async ({ page, analytics }) => {
  await page.goto('/?invite=private_query_marker#private_hash_marker');
  await waitForEvent(analytics, '$pageview');
  const identity = await waitForEvent(analytics, '$identify');
  expect(identity.properties.distinct_id).toBe('user_101');
  await page.getByRole('textbox', { name: 'Việc đang tập trung' }).fill('private_task_marker');
  await page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click();
  await page.getByRole('button', { name: 'Tạm dừng đồng hồ', exact: true }).click();
  const started = await waitForEvent(analytics, 'timer_started');
  const paused = await waitForEvent(analytics, 'timer_paused');
  for (const event of [started, paused]) {
    expect(event.properties).toMatchObject({ distinct_id: 'user_101', mode: 'focus', duration_minutes: 25 });
  }
  await waitForEvent(analytics, '$autocapture');
  // Check every outgoing POST, including feature-flag requests, without printing project tokens on failure.
  expect(analytics.payloads.some((payload) => JSON.stringify(payload).includes('private_'))).toBe(false);
  expect(analytics.events.filter((event) => event.event === 'timer_started')).toHaveLength(1);
  expect(analytics.events.filter((event) => event.event === 'timer_paused')).toHaveLength(1);
});

test('custom presets capture numeric durations while keeping their names private', async ({ page, analytics }) => {
  await page.goto('/');
  await waitForEvent(analytics, '$identify');
  await page.getByRole('button', { name: 'Mở cài đặt', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo bộ thời gian riêng', exact: true }).click();
  await page.getByPlaceholder('Ví dụ: Ôn thi buổi tối').fill('private_preset_marker');
  await page.getByRole('spinbutton', { name: 'Tập trung (phút)' }).fill('30');
  await page.getByRole('spinbutton', { name: 'Nghỉ ngắn (phút)' }).fill('6');
  await page.getByRole('spinbutton', { name: 'Nghỉ dài (phút)' }).fill('20');
  await page.getByRole('button', { name: 'Lưu và sử dụng', exact: true }).click();
  await expect(page.locator('.time')).toHaveText('30:00');
  const created = await waitForEvent(analytics, 'custom_preset_created');
  const applied = await waitForEvent(analytics, 'timer_preset_applied');
  for (const event of [created, applied]) {
    expect(event.properties).toMatchObject({ focus_minutes: 30, short_break_minutes: 6, long_break_minutes: 20 });
  }
  const opened = await waitForEvent(analytics, 'feature_opened');
  expect(opened.properties.feature).toBe('settings');
  expect(analytics.payloads.some((payload) => JSON.stringify(payload).includes('private_'))).toBe(false);
});

test('logout records the signed-in user then resets subsequent pageviews to a guest', async ({ page, analytics }) => {
  await page.goto('/');
  await waitForEvent(analytics, '$identify');
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('button', { name: /^Đăng xuất/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  const logout = await waitForEvent(analytics, 'auth_logout');
  expect(logout.properties.distinct_id).toBe('user_101');
  await expect.poll(() => analytics.events.find((event) => event.event === '$pageview' && event.properties.$current_url?.endsWith('/login'))?.properties.distinct_id, { timeout: 12_000 }).toBeTruthy();
  const loginView = analytics.events.find((event) => event.event === '$pageview' && event.properties.$current_url?.endsWith('/login'));
  expect(loginView.properties.distinct_id).not.toBe('user_101');
  expect(loginView.properties.$is_identified).toBe(false);
});

test('blocked analytics requests do not prevent studying', async ({ page, analytics }) => {
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click();
  await expect(page.locator('.time')).not.toHaveText('25:00', { timeout: 5_000 });
  await page.getByRole('button', { name: 'Tạm dừng đồng hồ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true })).toBeVisible();
  expect(analytics.events).toHaveLength(0);
});

test('anonymous visitors keep one identity across reloads', async ({ page, analytics }) => {
  analytics.expireSession();
  await page.goto('/');
  const first = await waitForEvent(analytics, '$pageview');
  await expect(page.getByRole('button', { name: 'Menu tài khoản', exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(() => analytics.events.filter((event) => event.event === '$pageview').length, { timeout: 12_000 }).toBe(2);
  const views = analytics.events.filter((event) => event.event === '$pageview');
  expect(first.properties.distinct_id).not.toBe('user_101');
  expect(views[1].properties.distinct_id).toBe(first.properties.distinct_id);
  expect(views[1].properties.$is_identified).toBe(false);
  expect(analytics.events.some((event) => event.event === '$identify')).toBe(false);
});

test('an expired login resets the stored user before visiting another page', async ({ page, analytics }) => {
  await page.goto('/');
  await waitForEvent(analytics, '$identify');
  analytics.expireSession();
  await page.reload();
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('button', { name: /Đăng nhập \/ Đăng ký/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => analytics.events.find((event) => event.event === '$pageview' && event.properties.$current_url?.endsWith('/login'))?.properties.distinct_id, { timeout: 12_000 }).toBeTruthy();
  const loginView = analytics.events.find((event) => event.event === '$pageview' && event.properties.$current_url?.endsWith('/login'));
  expect(loginView.properties.distinct_id).not.toBe('user_101');
  expect(loginView.properties.$is_identified).toBe(false);
});
