// Keep analytics optional: a missing key or a blocked request must never affect studying.
const projectKey = (import.meta.env.VITE_POSTHOG_KEY || '').trim();
const enabledSetting = import.meta.env.VITE_POSTHOG_ENABLED;
const enabled = (enabledSetting === undefined ? import.meta.env.PROD : enabledSetting === 'true')
  && projectKey.startsWith('phc_');

const eventNames = new Set([
  'auth_login_succeeded', 'auth_logout', 'registration_succeeded',
  'timer_started', 'timer_paused', 'timer_mode_changed', 'timer_skipped',
  'study_session_completed', 'timer_preset_applied', 'feature_opened',
  'custom_preset_created', 'custom_preset_deleted',
  'onboarding_started', 'onboarding_step_viewed', 'onboarding_completed', 'onboarding_skipped',
  'ai_reflection_submitted',
  'ai_reflection_viewed', 'ai_plan_applied', 'music_track_selected',
  'feedback_opened', 'feedback_dismissed',
]);
const numericProperties = new Set([
  'duration_minutes', 'break_minutes', 'focus_minutes', 'short_break_minutes',
  'long_break_minutes', 'step_number',
]);
const stringProperties = new Set(['mode', 'from_mode', 'to_mode', 'feature', 'step_id', 'last_step', 'method', 'source', 'form', 'entry_point', 'reflection_id', 'survey_version', 'language']);

let client;
let initialization;
let identifiedUser = null;
const pending = [];

function ingestionHost(value) {
  try {
    const url = new URL(value || 'https://us.i.posthog.com');
    if (url.protocol !== 'https:') return 'https://us.i.posthog.com';
    if (url.hostname === 'us.posthog.com') url.hostname = 'us.i.posthog.com';
    if (url.hostname === 'eu.posthog.com') url.hostname = 'eu.i.posthog.com';
    return url.origin;
  } catch {
    return 'https://us.i.posthog.com';
  }
}

function cleanUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

// Apply to SDK-generated properties too, including initial URL/referrer person properties.
function removePrivateProperties(value) {
  if (Array.isArray(value)) return value.map(removePrivateProperties);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    // The SDK's public project token is required by ingestion, unlike user credentials.
    if (key === 'token' && item === projectKey) { clean[key] = item; continue; }
    if (/password|email|username|authorization|token|\$el_text|attr__|\$title/i.test(key)) continue;
    clean[key] = typeof item === 'string' && /url|href|referrer/i.test(key)
      ? cleanUrl(item) : removePrivateProperties(item);
  }
  return clean;
}

function run(operation) {
  if (!enabled) return;
  if (client) {
    try { operation(client); } catch { /* Analytics is best effort. */ }
    return;
  }
  if (pending.length < 100) pending.push(operation);
  void initializeAnalytics();
}

export function initializeAnalytics() {
  if (!enabled) return Promise.resolve(false);
  if (initialization) return initialization;
  initialization = import('posthog-js').then(({ default: posthog }) => {
    client = posthog.init(projectKey, {
      api_host: ingestionHost(import.meta.env.VITE_POSTHOG_HOST),
      ui_host: 'https://us.posthog.com',
      defaults: '2026-05-30',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      person_profiles: 'identified_only',
      autocapture: {
        dom_event_allowlist: ['click'],
        element_allowlist: ['a', 'button'],
        capture_copied_text: false,
      },
      mask_all_text: true,
      mask_all_element_attributes: true,
      disable_session_recording: true,
      enable_recording_console_log: false,
      capture_exceptions: false,
      capture_performance: false,
      // Feedback uses our own lazy-loaded UI and PostHog's headless response events.
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      disable_web_experiments: true,
      // The app uses event analytics only; avoid flag-evaluation requests with URL context.
      advanced_disable_flags: true,
      disable_capture_url_hashes: true,
      get_current_url: () => cleanUrl(window.location.href),
      save_campaign_params: false,
      save_referrer: false,
      respect_dnt: true,
      before_send: (event) => {
        event.properties = removePrivateProperties(event.properties);
        if (event.$set) event.$set = removePrivateProperties(event.$set);
        if (event.$set_once) event.$set_once = removePrivateProperties(event.$set_once);
        return event;
      },
      loaded: (sdk) => sdk.register({ app_name: 'DoroStudy', app_environment: import.meta.env.PROD ? 'production' : 'development' }),
    });
    if (client) {
      for (const operation of pending.splice(0)) {
        try { operation(client); } catch { /* Do not block the app on analytics. */ }
      }
    }
    return Boolean(client);
  }).catch(() => {
    pending.length = 0;
    return false;
  });
  return initialization;
}

export function captureEvent(name, properties = {}) {
  if (!eventNames.has(name)) return;
  const safe = {};
  for (const [key, value] of Object.entries(properties)) {
    if (numericProperties.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1440) {
      safe[key] = value;
    } else if (stringProperties.has(key) && typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value)) {
      safe[key] = value;
    }
  }
  run((sdk) => sdk.capture(name, safe, {
    send_instantly: name.startsWith('auth_') || name === 'registration_succeeded',
  }));
}

export function identifyUser(userId) {
  // Backend IDs only. Names, email addresses and credentials do not belong in analytics.
  if (!/^\d+$/.test(String(userId)) || String(userId) === '0') return;
  const id = `user_${userId}`;
  if (identifiedUser === id) return;
  identifiedUser = id;
  run((sdk) => sdk.identify(id));
}

export function resetAnalytics() {
  identifiedUser = null;
  run((sdk) => {
    // Repeated anonymous /me responses must preserve returning-visitor statistics.
    if (/^user_\d+$/.test(sdk.get_distinct_id())) sdk.reset();
  });
}

// Explicit feedback must report delivery failure, unlike best-effort usage analytics.
// Only this dedicated path accepts the comment the visitor deliberately chooses to submit.
export async function getFeedbackAnalyticsContext() {
  if (!enabled) throw new Error('Biểu mẫu góp ý hiện chưa sẵn sàng. Bạn có thể tải nhận xét để gửi trực tiếp cho nhóm.');
  if (!(await initializeAnalytics()) || !client) throw new Error('Chưa kết nối được dịch vụ góp ý. Vui lòng thử lại.');
  if (client.has_opted_out_capturing() || navigator.doNotTrack === '1' || window.doNotTrack === '1') {
    throw new Error('Trình duyệt đang bật chế độ không theo dõi. Góp ý chưa được gửi; bạn có thể sao chép nội dung để gửi trực tiếp cho nhóm.');
  }
  return {
    apiHost: ingestionHost(import.meta.env.VITE_POSTHOG_HOST), projectKey,
    distinctId: client.get_distinct_id(), sessionId: client.get_session_id(),
    identified: /^user_\d+$/.test(client.get_distinct_id()),
  };
}

export function captureFeedbackSurveyLifecycle(surveyId, stage, properties) {
  if (!/^[a-f0-9-]{36}$/i.test(surveyId || '') || !['shown', 'dismissed'].includes(stage)) return;
  run(sdk => sdk.capture(`survey ${stage}`, { $survey_id: surveyId, $survey_iteration: 0, ...properties }));
}
