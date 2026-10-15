import { expect, test as base } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { FEEDBACK_SURVEYS } from '../src/lib/feedbackSchema.js';

const REFLECTION = { id: 81, sessionId: 71, summary: 'Phiên học bị gián đoạn bởi tiếng ồn.', recommendation: 'Thử tai nghe và một phiên ngắn hơn.', aiAvailable: true, source: 'gemini', focusScore: 66, distractionReasons: ['noise'] };
const test = base.extend({
  feedback: [async ({ page, baseURL }, use) => {
    const events = []; const submissions = []; const apiRequests = []; const runtimeErrors = [];
    const state = { guest: false, noReflection: false, source: 'gemini', failNext: false, rejectNext: false, failLookup: false };
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('dorostudy.onboarding.v2', 'done');
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '130' }], mobile: false, platform: 'Windows' }) });
    });
    // Never upload synthetic comments or analytics into the real project.
    await page.route(/https:\/\/[^/]*posthog\.com\//, async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        let buffer = request.postDataBuffer();
        if (buffer?.length) {
          if (buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = gunzipSync(buffer);
          let text = buffer.toString();
          if (text.startsWith('data=')) {
            text = new URLSearchParams(text).get('data');
            if (!text.startsWith('{') && !text.startsWith('[')) text = Buffer.from(text, 'base64').toString();
          }
          const payload = JSON.parse(text);
          const captured = Array.isArray(payload) ? payload : payload.batch || [payload];
          events.push(...captured.filter(event => event.event));
          const sent = captured.find(event => ['survey sent', 'feedback_submitted'].includes(event.event));
          if (sent) {
            submissions.push(sent);
            if (state.failNext) { state.failNext = false; return route.fulfill({ status: 503, json: { status: 0 } }); }
            if (state.rejectNext) { state.rejectNext = false; return route.fulfill({ json: { status: 0, error: 'rejected' } }); }
          }
        }
      }
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: request.url().endsWith('.js') ? 'application/javascript' : 'application/json', body: request.url().endsWith('.js') ? '' : JSON.stringify({ status: 1, supportedCompression: ['gzip-js'], hasFeatureFlags: false, featureFlags: {}, sessionRecording: false, surveys: [] }) });
    });
    await page.route(`${baseURL}/api/**`, async route => {
      const request = route.request(); const url = new URL(request.url()); apiRequests.push({ path: url.pathname, method: request.method(), query: url.search });
      if (url.pathname === '/api/auth/me' && state.guest) return route.fulfill({ status: 401, json: {} });
      if (url.pathname === '/api/reflections' && request.method() === 'GET' && state.failLookup) {
        state.failLookup = false; return route.fulfill({ status: 503, json: {} });
      }
      const reflection = { ...REFLECTION, source: state.source, aiAvailable: state.source === 'gemini' };
      const body = url.pathname === '/api/auth/me' ? { id: 101, name: 'private_profile_marker', email: 'private_email_marker@example.test' }
        : url.pathname === '/api/reflections/next-session' ? { headline: 'Một phiên ngắn', durationMinutes: 25, breakMinutes: 5, predictedFocusScore: 65, timingVerdict: 'UNKNOWN', reasons: [], basedOnSessions: 0 }
          : url.pathname === '/api/reflections' ? (request.method() === 'POST' ? reflection : state.noReflection ? [] : [reflection])
            : url.pathname === '/api/nudges/config' ? { enabled: false, subscribed: false } : {};
      return route.fulfill({ json: body });
    });
    await page.route('https://accounts.google.com/**', route => route.abort());
    await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '' }));
    await use({ events, submissions, apiRequests, state });
    expect(runtimeErrors).toEqual([]);
  }, { auto: true }],
});
test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });

async function open(page) {
  await page.goto('/?utm_source=student_group&utm_campaign=checkpoint2&private_query_marker=secret');
  await page.locator('.product-feedback-button').click();
  await expect(page.getByRole('dialog', { name: 'Góp ý để mỗi phiên học tốt hơn' })).toBeVisible();
}
async function fillUx(page, comment = 'ux_comment_marker: Nút tạm dừng khó tìm trên điện thoại.') {
  await page.locator('#df-comment').fill(comment);
  await page.locator('#df-area').selectOption('timer');
  await page.locator('#df-issue').selectOption('hard_to_use');
}
async function fillAi(page) {
  await page.getByRole('button', { name: 'AI Reflection', exact: true }).click();
  await page.locator('.df-rating label').nth(3).click();
  await page.getByText('Tôi biết bước tiếp theo cần làm', { exact: true }).click();
}
async function sent(page) {
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn đã chia sẻ!' })).toBeVisible();
}

test('visitors write real UX/UI comments without signing in or adding database writes', async ({ page, feedback }, testInfo) => {
  feedback.state.guest = true;
  await open(page); await fillUx(page);
  expect(feedback.submissions).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('ux-comment.png') });
  await sent(page);
  expect(feedback.submissions).toHaveLength(1);
  const event = feedback.submissions[0];
  expect(event.properties).toMatchObject({ form: 'ux', area: 'timer', issue_type: 'hard_to_use', campaign_source: 'student_group', campaign: 'checkpoint2', $process_person_profile: false });
  expect(event.properties.feedback_comment).toContain('ux_comment_marker');
  if (event.event === 'survey sent') {
    expect(event.properties[`$survey_response_${FEEDBACK_SURVEYS.ux.questions[0].id}`]).toContain('ux_comment_marker');
  } else {
    expect(event.event).toBe('feedback_submitted');
    expect(event.properties).not.toHaveProperty('$survey_id');
  }
  expect(feedback.apiRequests.some(request => request.method !== 'GET')).toBe(false);
  expect(feedback.apiRequests.some(request => request.path === '/api/reflections')).toBe(false);
  expect(JSON.stringify(event)).not.toContain('private_');
  await page.getByRole('button', { name: 'Quay lại học' }).click();
  await expect(page.locator('.product-feedback-button')).toBeFocused();
});

test('comments are never included in background analytics while typing', async ({ page, feedback }) => {
  await open(page); await fillUx(page, 'draft_only_private_marker');
  await page.getByRole('button', { name: 'Để sau', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click();
  await expect.poll(() => feedback.events.some(event => event.event === 'timer_started'), { timeout: 12000 }).toBe(true);
  expect(feedback.submissions).toHaveLength(0);
  expect(JSON.stringify(feedback.events)).not.toContain('draft_only_private_marker');
});

test('AI questions reuse the latest reflection and allow a short core response', async ({ page, feedback }, testInfo) => {
  await open(page); await fillAi(page);
  await page.locator('#df-comment').fill('ai_comment_marker: Cần lời khuyên sát tình huống hơn.');
  await page.screenshot({ path: testInfo.outputPath('ai-comment.png') });
  await sent(page);
  expect(feedback.submissions[0].properties).toMatchObject({ form: 'ai', reflection_id: '81', ai_source: 'gemini', usefulness: 4, actionability: 'clear', distinct_id: 'user_101' });
  expect(feedback.submissions[0].properties).not.toHaveProperty('distraction');
  expect(feedback.apiRequests.filter(request => request.path === '/api/reflections')).toEqual([{ path: '/api/reflections', method: 'GET', query: '?limit=1' }]);
});

for (const [distraction, action, support] of [['social_media', 'move_phone', 'timer_controls'], ['noise', 'background_audio', 'music'], ['fatigue', 'rest', 'breaks'], ['mind_wandering', 'write_note', 'notes'], ['difficult_content', 'split_task', 'smaller_goal'], ['other', 'pause', 'no_support']]) {
  test(`real distraction incident: ${distraction}`, async ({ page, feedback }) => {
    await open(page); await fillAi(page);
    await page.getByRole('button', { name: /Kể thêm cách bạn xử lý/ }).click();
    await page.locator('#df-distraction').selectOption(distraction);
    await expect(page.getByRole('button', { name: 'Gửi góp ý', exact: true })).toBeDisabled();
    await page.locator('#df-action').selectOption(action);
    await page.locator('#df-outcome').selectOption('returned');
    await page.locator('#df-support').selectOption(support);
    await sent(page);
    expect(feedback.submissions[0].properties).toMatchObject({ distraction, coping_action: action, outcome: 'returned', requested_support: support });
  });
}

test('no distraction hides irrelevant questions', async ({ page, feedback }) => {
  await open(page); await fillAi(page);
  await page.getByRole('button', { name: /Kể thêm cách bạn xử lý/ }).click();
  await page.locator('#df-distraction').selectOption('none');
  await expect(page.locator('#df-action')).toHaveCount(0);
  await sent(page);
  expect(feedback.submissions[0].properties.distraction).toBe('none');
  expect(feedback.submissions[0].properties).not.toHaveProperty('coping_action');
});

test('failed delivery retains text and reuses the submission UUID on retry', async ({ page, feedback }) => {
  feedback.state.failNext = true;
  await open(page); await fillUx(page);
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#df-comment')).toContainText('ux_comment_marker');
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn đã chia sẻ!' })).toHaveCount(0);
  await sent(page);
  expect(feedback.submissions).toHaveLength(2);
  expect(feedback.submissions[0].uuid).toBe(feedback.submissions[1].uuid);
});

test('an HTTP success containing a rejected receipt is not shown as delivered', async ({ page, feedback }) => {
  feedback.state.rejectNext = true;
  await open(page); await fillUx(page);
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn đã chia sẻ!' })).toHaveCount(0);
});

test('switching forms keeps separate drafts and Escape restores focus', async ({ page }) => {
  await open(page); await fillUx(page, 'Bản góp ý giao diện đang viết');
  await fillAi(page);
  await page.locator('#df-comment').fill('Bản góp ý AI đang viết');
  await page.getByRole('button', { name: 'Giao diện & trải nghiệm', exact: true }).click();
  await expect(page.locator('#df-comment')).toHaveValue('Bản góp ý giao diện đang viết');
  await page.getByRole('button', { name: 'AI Reflection', exact: true }).click();
  await expect(page.locator('#df-comment')).toHaveValue('Bản góp ý AI đang viết');
  await page.keyboard.press('Escape');
  await expect(page.locator('.df-dialog')).toHaveCount(0);
  await expect(page.locator('.product-feedback-button')).toBeFocused();
});

test('no AI experience gives guidance while keeping UX comments available', async ({ page, feedback }) => {
  feedback.state.noReflection = true;
  await open(page);
  await page.getByRole('button', { name: 'AI Reflection', exact: true }).click();
  await expect(page.getByText('Bạn chưa có phản hồi sau phiên học để đánh giá.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Viết góp ý UX/UI', exact: true }).click();
  await fillUx(page); await sent(page);
});

test('fallback feedback is clearly distinguished from Gemini feedback', async ({ page, feedback }) => {
  feedback.state.source = 'unavailable';
  await open(page); await fillAi(page);
  await expect(page.getByText(/Đây là phản hồi dự phòng/)).toBeVisible();
  await sent(page);
  expect(feedback.submissions[0].properties.ai_source).toBe('unavailable');
});

test('one-minute submission cooldown avoids repeated sends', async ({ page, feedback }) => {
  await open(page); await fillUx(page); await sent(page);
  await page.getByRole('button', { name: 'Quay lại học' }).click();
  await page.locator('.product-feedback-button').click(); await fillUx(page, 'Một ý kiến khác');
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('một phút');
  expect(feedback.submissions).toHaveLength(1);
});

test('Do Not Track is respected and comments can be downloaded instead', async ({ page, feedback }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  await open(page); await fillUx(page);
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('không theo dõi');
  expect(feedback.submissions).toHaveLength(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải nội dung nhận xét về máy', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('dorostudy-gop-y.txt');
});

test('feedback dialog fits the viewport and keyboard stays in the dialog', async ({ page }) => {
  await open(page);
  const box = await page.locator('.df-dialog').boundingBox();
  const { width, height } = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(height);
  expect(await page.locator('.df-dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement.closest('.df-dialog')))).toBe(true);
  }
});

test('inline entry rates the exact Reflection without fetching or generating another result', async ({ page, feedback }) => {
  await page.addInitScript(() => localStorage.setItem('dorostudy.pendingReflection', JSON.stringify({ sessionId: 71, userId: 101 })));
  await page.goto('/');
  await page.locator('.reflection-emoji[title="Rất tập trung"]').click();
  await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click();
  await page.getByRole('button', { name: /Phản hồi này có giúp bạn không/ }).click();
  await page.locator('.df-rating label').nth(3).click();
  await page.getByText('Tôi biết bước tiếp theo cần làm', { exact: true }).click();
  await sent(page);
  expect(feedback.submissions[0].properties).toMatchObject({ form: 'ai', reflection_id: '81', entry_point: 'reflection_result' });
  expect(feedback.apiRequests.filter(request => request.path === '/api/reflections')).toEqual([{ path: '/api/reflections', method: 'POST', query: '' }]);
  await page.getByRole('button', { name: 'Quay lại học' }).click();
  await expect(page.locator('.reflection-result')).toBeVisible();
  await expect.poll(() => feedback.events.some(event => event.event === 'ai_reflection_viewed'), { timeout: 12000 }).toBe(true);
});

test('failed history lookup can retry and does not leave a permanent loading state', async ({ page, feedback }) => {
  feedback.state.failLookup = true;
  await open(page);
  await page.getByRole('button', { name: 'AI Reflection', exact: true }).click();
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await page.locator('.df-rating label').nth(3).click();
  await page.getByText('Tôi biết bước tiếp theo cần làm', { exact: true }).click();
  await sent(page);
});

test('blocked PostHog never shows successful delivery or loses the comment', async ({ page }) => {
  await page.route(/https:\/\/[^/]*posthog\.com\//, route => route.abort());
  await open(page); await fillUx(page);
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#df-comment')).toHaveValue(/ux_comment_marker/);
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn đã chia sẻ!' })).toHaveCount(0);
});
