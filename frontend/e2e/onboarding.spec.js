import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  page.on('pageerror', (error) => console.error('Browser runtime error:', error.message));
  // Isolate the UI from authentication, quota and production data.
  await page.route(`${baseURL}/api/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/auth/me'
      ? { id: 101, name: 'Người học thử', username: 'tour_test' }
      : path === '/api/reflections/next-session'
        ? { headline: 'Một phiên ngắn để bắt đầu', predictedFocusScore: 72, timingVerdict: 'UNKNOWN', durationMinutes: 25, breakMinutes: 5, personalized: false, basedOnSessions: 0, timingMessage: 'Hãy thử 25 phút và nhìn lại mức tập trung của mình.', reasons: ['Chọn một việc vừa sức cho phiên đầu tiên.'] }
        : path === '/api/nudges/config' ? { enabled: false, subscribed: false } : null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  // Never send synthetic onboarding users to the real analytics project.
  await page.route(/^https:\/\/(?:us|eu)(?:-assets)?\.i\.posthog\.com\//, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
});

async function checkSpotlight(page, target) {
  await expect(page.locator('.tour-card')).toBeVisible();
  await expect.poll(async () => {
    const box = await page.locator('.tour-spotlight').boundingBox();
    const element = await page.locator(`[data-tour="${target}"]`).boundingBox();
    return box && element && Math.abs(box.x - Math.max(0, element.x - 7)) < 2 && Math.abs(box.y - Math.max(0, element.y - 7)) < 2;
  }).toBeTruthy();
  const card = await page.locator('.tour-card').boundingBox();
  const box = await page.locator('.tour-spotlight').boundingBox();
  const { width, height } = page.viewportSize();
  expect(card.x).toBeGreaterThanOrEqual(11);
  expect(card.y).toBeGreaterThanOrEqual(11);
  expect(card.x + card.width).toBeLessThanOrEqual(width - 11);
  expect(card.y + card.height).toBeLessThanOrEqual(height - 11);
  expect(card.x < box.x + box.width && card.x + card.width > box.x && card.y < box.y + box.height && card.y + card.height > box.y).toBeFalsy();
}

test('walkthrough follows real controls and does not start a study session', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await checkSpotlight(page, 'task');
  await page.getByRole('textbox', { name: 'Việc đang tập trung' }).fill('Ôn chương 2 môn Toán');
  await page.screenshot({ path: testInfo.outputPath('tour-task.png') });
  const steps = ['modes', 'settings', 'start', 'notifications', 'tools', 'progress'];
  for (const target of steps) {
    await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
    await checkSpotlight(page, target);
    if (target === 'start') {
      const button = await page.locator('[data-tour="start"]').boundingBox();
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      await expect(page.locator('[data-tour="start"]')).toHaveText('Bắt đầu');
    }
  }
  await page.getByRole('button', { name: 'Bắt đầu học', exact: true }).click();
  await expect(page.locator('.onboarding-tour')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Việc đang tập trung' })).toHaveValue('Ôn chương 2 môn Toán');
  await expect(page.locator('.time')).toHaveText('25:00');
  await expect(page.getByRole('button', { name: 'Bắt đầu phiên học' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('timer.png') });
  await page.reload();
  await expect(page.locator('.onboarding-tour')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('settings can be used inside the tour, custom preset persists and replay restores focus', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.locator('.tour-card').getByRole('button', { name: 'Mở cài đặt', exact: true }).click();
  await checkSpotlight(page, 'custom-preset');
  await page.getByRole('button', { name: 'Tạo bộ thời gian riêng', exact: true }).click();
  await expect(page.getByPlaceholder('Ví dụ: Ôn thi buổi tối')).toBeVisible();
  await page.getByPlaceholder('Ví dụ: Ôn thi buổi tối').click();
  await page.getByPlaceholder('Ví dụ: Ôn thi buổi tối').fill('Ôn thi thử');
  await page.getByRole('spinbutton', { name: 'Tập trung (phút)' }).click();
  await page.getByRole('spinbutton', { name: 'Tập trung (phút)' }).fill('30');
  await page.getByRole('spinbutton', { name: 'Nghỉ ngắn (phút)' }).click();
  await page.getByRole('spinbutton', { name: 'Nghỉ ngắn (phút)' }).fill('6');
  await page.getByRole('spinbutton', { name: 'Nghỉ dài (phút)' }).click();
  await page.getByRole('spinbutton', { name: 'Nghỉ dài (phút)' }).fill('20');
  await page.screenshot({ path: testInfo.outputPath('tour-preset.png') });
  await page.getByRole('button', { name: 'Lưu và sử dụng', exact: true }).click();
  await expect(page.locator('.timer-settings-backdrop')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.time')).toHaveText('30:00');
  await page.getByRole('button', { name: 'Hướng dẫn trên màn hình', exact: true }).click();
  await checkSpotlight(page, 'task');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Hướng dẫn trên màn hình', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Mở cài đặt', exact: true }).click();
  await expect(page.getByRole('button', { name: /Ôn thi thử/ })).toBeVisible();
});

test('resize and keyboard navigation keep the tour usable, and skip is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tour-card')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('.tour-card, [data-tour="task"]')))).toBeTruthy();
  }
  await page.setViewportSize({ width: 360, height: 640 });
  await checkSpotlight(page, 'task');
  await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  await page.reload();
  await expect(page.locator('.onboarding-tour')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hướng dẫn trên màn hình', exact: true }).click();
  await expect(page.locator('.onboarding-tour')).toHaveAttribute('data-step', 'task');
});

test('cancelling a preset leaves the tour attached to the create button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
  await page.locator('.tour-card').getByRole('button', { name: 'Mở cài đặt', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo bộ thời gian riêng', exact: true }).click();
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await checkSpotlight(page, 'custom-preset');
  await page.getByRole('button', { name: 'Tạo bộ thời gian riêng', exact: true }).click();
  await expect(page.getByPlaceholder('Ví dụ: Ôn thi buổi tối')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.timer-settings-backdrop')).toHaveCount(0);
  await expect(page.locator('.time')).toHaveText('25:00');
});

test('a pending survey is visible before onboarding, then onboarding resumes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dorostudy.pendingReflection', JSON.stringify({ sessionId: 777, userId: 101 })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hoàn thành phiên học/ })).toBeVisible();
  await expect(page.locator('.onboarding-tour')).toHaveCount(0);
  await page.locator('.reflection-backdrop').getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  await checkSpotlight(page, 'task');
});
