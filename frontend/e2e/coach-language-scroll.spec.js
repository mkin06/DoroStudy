import { expect, test } from '@playwright/test';

const plan = {
  headline: 'Học môn WBAN trong 15 phút, ngay bây giờ', subject: 'WBAN',
  durationMinutes: 15, breakMinutes: 5, predictedFocusScore: 82,
  personalized: true, basedOnSessions: 8, confidence: 80, timingVerdict: 'OK',
  timingMessage: 'Buổi chiều của bạn ở mức ổn (75 điểm), chỉ thấp hơn buổi tối 1 điểm. Học được.',
  guardrail: 'Trước khi bấm Start: đeo tai nghe và bật nhạc nền trong app.',
  streakMessage: 'Học một phiên hôm nay để bắt đầu chuỗi ngày liên tiếp.',
  reasons: [
    'Phiên 15 phút là độ dài cho điểm cao nhất của bạn.',
    'Môn WBAN +3 điểm so với trung bình của bạn (4 phiên).',
    'Học buổi chiều +2 điểm so với trung bình của bạn (2 phiên).',
    'Phiên 15 phút +7 điểm so với trung bình của bạn (2 phiên).',
  ],
  accuracy: { sampleSize: 4, meanAbsoluteError: 2 },
};

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dorostudy.onboarding.v2', 'done');
      localStorage.setItem('dorostudy.language', 'vi');
    } catch { /* Third-party frames may have no storage. */ }
  });
  await page.route(/https:\/\/[^/]*posthog\.com\//, route => route.fulfill({ json: { status: 1 } }));
  await page.route('https://accounts.google.com/**', route => route.abort());
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '' }));
  await page.route(`${baseURL}/api/**`, route => {
    const path = new URL(route.request().url()).pathname;
    const json = path === '/api/auth/me' ? { id: 42, username: 'coach_test', name: 'Coach test' }
      : path === '/api/reflections/next-session' ? plan
      : path === '/api/nudges/config' ? { enabled: false, subscribed: false }
      : path === '/api/reflections' ? [] : {};
    return route.fulfill({ json });
  });
});

test('the complete WBAN plan switches language without mixed text or incorrect score bindings', async ({ page }) => {
  await page.goto('/');
  await page.locator('.coach-summary').click();
  await expect(page.locator('.coach-timing')).toContainText(plan.timingMessage);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.coach-headline')).toHaveText('Study WBAN for 15 minutes now');
  await expect(page.locator('.coach-timing')).toContainText('You average 75 points when studying in the afternoon, compared with studying in the evening (a 1-point gap).');
  await expect(page.locator('.coach-reasons li').nth(2)).toHaveText('Studying in the afternoon: +2 points versus your average (2 sessions).');
  await expect(page.locator('.coach-reasons li').last()).toHaveText('15-minute sessions: +7 points versus your average (2 sessions).');
  expect(await page.locator('.coach-card').innerText()).not.toMatch(/[À-ỹĐđ]/u);
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.locator('.coach-timing')).toContainText(plan.timingMessage);
  await expect(page.locator('.coach-reasons li').last()).toHaveText(plan.reasons[3]);
});

test('focus profile localizes the score label, streak, discoveries and next unlock', async ({ page, baseURL }) => {
  await page.route(`${baseURL}/api/reflections/insights`, route => route.fulfill({ json: {
    totalSessions: 8, averageFocusScore: 82, bestFocusScore: 90, tierName: 'Đang dò quy luật',
    consistency: { currentStreakDays: 3, bestStreakDays: 3, message: 'Chuỗi 3 ngày liên tiếp. Học hôm nay để giữ mạch.' },
    discoveries: [{ id: 'noise', title: 'Thủ phạm số 1', confidence: 80, evidence: '8 phiên',
      detail: 'tiếng ồn xuất hiện ở 3/8 phiên (38%). Những phiên không bị nó làm phiền, bạn cao hơn 9 điểm.' }],
    nextUnlockName: 'Giờ vàng theo từng môn', sessionsToNextUnlock: 2,
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.locator('.fp-hero-label')).toContainText('Good');
  await expect(page.locator('.fp-consistency')).toContainText('A 3-day streak. Study today to keep it going.');
  await expect(page.locator('.fp-discovery')).toContainText('You scored 9 points higher in sessions without this distraction.');
  await expect(page.locator('.fp-unlock')).toContainText('Best study times by subject');
  expect(await page.locator('.fp-panel').innerText()).not.toMatch(/[À-ỹĐđ]/u);
});

for (const short of [false, true]) test(`expanded advice and timer controls remain reachable${short ? ' in a short window' : ''}`, async ({ page }, testInfo) => {
  if (short) await page.setViewportSize({ width: 720, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.locator('.coach-summary').click();
  const card = page.locator('.coach-card');
  const geometry = await card.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.height + 1);
  await page.locator('.coach-reasons li').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.coach-reasons li').last()).toBeInViewport();
  await page.locator('.coach-apply').scrollIntoViewIfNeeded();
  await expect(page.locator('.coach-apply')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('expanded-coach.png') });
  expect(await page.locator('.timer-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator('.coach-apply').click();
  await expect(page.locator('.coach-apply')).toHaveText('Applied');
  await expect(page.locator('.time')).toHaveText('15:00');
  const start = page.getByRole('button', { name: 'Start study session', exact: true });
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeInViewport();
  await page.locator('.timer-content').evaluate(el => { el.scrollTop = 0; });
  await expect(page.locator('.preset-dots')).toBeInViewport();
  await start.click();
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeInViewport();
});
