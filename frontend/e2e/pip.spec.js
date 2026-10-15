import { expect, test } from '@playwright/test';

// Exercise actual rendering in a second browser document, with a window shim
// for the OS-level always-on-top API that headless browsers cannot display.
test.beforeEach(async ({ page, context, baseURL }) => {
  await context.route(`${baseURL}/__pip-test-document`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await context.route(/https:\/\/[^/]*posthog\.com\//, route => route.fulfill({ json: { status: 1 } }));
  await context.route('https://accounts.google.com/**', route => route.abort());
  await context.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '<html style="background:#151c24"></html>' }));
  await context.route('https://www.youtube.com/**', route => route.fulfill({ body: '' }));
  await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#31504f"/></svg>' }));
  await context.route('https://i.ytimg.com/**', route => route.abort());
  await page.route(`${baseURL}/api/**`, route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/auth/me' ? { id: 42, name: 'PiP tester' }
      : path === '/api/nudges/config' ? { enabled: false } : null });
  });
  await page.addInitScript(() => {
    localStorage.setItem('dorostudy.onboarding.v2', 'done');
    if (!localStorage.getItem('dorostudy.language')) localStorage.setItem('dorostudy.language', 'vi');
    Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: {
      requestWindow: async ({ width, height }) => {
        const child = window.open('/__pip-test-document', '_blank', `popup,width=${width},height=${height}`);
        window.testPipWindow = child;
        await new Promise(resolve => child.addEventListener('load', resolve, { once: true }));
        return child;
      },
    } });
  });
  await page.goto('/');
});

async function openPip(page) {
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Bật hoặc tắt đồng hồ thu nhỏ' }).click();
  const pip = await popup;
  await expect(pip.locator('#pip-timer')).toHaveText('25:00');
  return pip;
}

async function openBackground(page) {
  await page.locator('.footer-left').getByRole('button', { name: 'Hình nền', exact: true }).click();
}

test('PiP covers the entire window without white gutters at multiple sizes', async ({ page }, testInfo) => {
  const pip = await openPip(page);
  for (const size of [{ width: 450, height: 280 }, { width: 260, height: 170 }, { width: 720, height: 190 }]) {
    await pip.setViewportSize(size);
    expect(await pip.locator('.pip-container').boundingBox()).toEqual({ x: 0, y: 0, ...size });
    expect(await pip.locator('.study-background').boundingBox()).toEqual({ x: 0, y: 0, ...size });
    const bounds = await pip.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      rootHeight: document.documentElement.clientHeight,
      scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    }));
    expect(bounds).toEqual({ body: 'rgb(21, 28, 36)', rootHeight: size.height, scroll: false });
    await expect(pip.locator('#pip-play-pause')).toBeInViewport();
    await expect(pip.locator('#pip-skip')).toBeInViewport();
  }
  await pip.setViewportSize({ width: 450, height: 280 });
  const loadedBackground = await pip.locator('.study-background-image').evaluate(async element => {
    const image = new Image();
    image.src = getComputedStyle(element).backgroundImage.slice(5, -2);
    await Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
    return { width: image.naturalWidth, src: image.src, base: document.baseURI, background: getComputedStyle(element).backgroundImage };
  });
  expect(loadedBackground.width, JSON.stringify(loadedBackground)).toBeGreaterThan(0);
  await pip.screenshot({ path: testInfo.outputPath('pip-full-background.png') });
  await pip.close();
});

test('PiP follows selected image, darkness and weather while already open', async ({ page }, testInfo) => {
  const pip = await openPip(page);
  await openBackground(page);
  await page.getByRole('button', { name: 'Ảnh tĩnh', exact: true }).click();
  await page.locator('.scene-card').filter({ hasText: 'Bãi biển' }).click();
  await expect(pip.locator('.study-background')).toHaveAttribute('data-scene', 'beach-still');
  const mainImage = await page.locator('.timer-container > .study-background .study-background-image').evaluate(el => el.style.backgroundImage);
  await expect(pip.locator('.study-background-image')).toHaveCSS('background-image', mainImage);
  await page.locator('.brightness-range').fill('0.65');
  await expect(pip.locator('.study-background-shade')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.65)');
  await page.locator('.category-selector').getByRole('button', { name: 'Thời tiết', exact: true }).click();
  await page.locator('.weather-card').filter({ hasText: 'Mùa tuyết' }).click();
  await expect(pip.locator('.study-snow i')).toHaveCount(60);
  await page.locator('.weather-card').filter({ hasText: 'Mưa giông' }).click();
  await expect(pip.locator('.study-rain i')).toHaveCount(80);
  await expect(pip.locator('.study-snow')).toHaveCount(0);
  await expect(pip.locator('.study-lightning')).toHaveCount(1);
  await pip.screenshot({ path: testInfo.outputPath('pip-custom-scene.png') });
  await pip.close();
});

test('PiP controls stay in sync with start, pause, mode, language and reopening', async ({ page }) => {
  let pip = await openPip(page);
  await pip.locator('#pip-play-pause').click();
  await expect(page.getByRole('button', { name: 'Tạm dừng đồng hồ', exact: true })).toBeVisible();
  await expect(pip.locator('#pip-timer')).not.toHaveText('25:00');
  await page.getByRole('button', { name: 'Tạm dừng đồng hồ', exact: true }).click();
  await expect(pip.locator('#pip-play-pause')).toHaveText('Bắt đầu');
  expect(await pip.locator('#pip-timer').innerText()).toBe(await page.locator('.time').innerText());
  await pip.locator('#pip-skip').click();
  await expect(pip.locator('#pip-timer')).toHaveText('05:00');
  await expect(pip.locator('.pip-mode')).toHaveText('Giờ nghỉ');
  await pip.locator('#pip-skip').click();
  await expect(pip.locator('#pip-timer')).toHaveText('25:00');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(pip.locator('html')).toHaveAttribute('lang', 'en');
  await expect(pip.locator('#pip-play-pause')).toHaveText('Start');
  await page.getByRole('button', { name: 'Toggle mini timer' }).click();
  await expect.poll(() => pip.isClosed()).toBe(true);
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  pip = await openPip(page);
  await pip.close();
  pip = await openPip(page);
  await expect(pip.locator('.pip-mode')).toHaveText('Tập trung');
});

test('PiP uses the selected YouTube and MP4 backgrounds with a fallback on video failure', async ({ page, context }) => {
  const pip = await openPip(page);
  await openBackground(page);
  await page.locator('.scene-card').filter({ hasText: 'Lửa trại ấm cúng' }).click();
  await expect(pip.locator('.study-background-youtube')).toHaveAttribute('src', /nALYrGwgVVo/);
  await page.getByRole('button', { name: 'Tùy chỉnh', exact: true }).click();
  await page.locator('.personalize-form input[type="url"]').fill('https://example.test/background.mp4');
  await page.getByRole('radio', { name: 'Video lặp' }).check();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('https://example.test/background.mp4', async route => { await gate; await route.abort(); });
  await page.getByRole('button', { name: 'Áp dụng không gian riêng' }).click();
  await expect(pip.locator('video')).toHaveAttribute('src', 'https://example.test/background.mp4');
  expect(await pip.locator('video').evaluate(video => video.muted && video.loop && video.autoplay)).toBe(true);
  // Popup adapters may suspend media decoding; exercise the media error event
  // deterministically rather than relying on an OS media pipeline in headless mode.
  await pip.locator('video').dispatchEvent('error');
  release();
  await expect(pip.locator('video')).toHaveCount(0);
  await expect(pip.locator('.study-background-image')).toBeVisible();
  await expect(pip.locator('.pip-container')).toBeVisible();
});
