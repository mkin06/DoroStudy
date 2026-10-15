import { captureEvent, captureFeedbackSurveyLifecycle, getFeedbackAnalyticsContext } from './analytics';
import { ACTIONABILITY, AREAS, COMMENT_LIMIT, COMMON_ACTIONS, COPING_ACTIONS, DISTRACTIONS, FEEDBACK_SURVEYS, FEEDBACK_VERSION, ISSUE_TYPES, OUTCOMES, SUPPORTS, responseLabel } from './feedbackSchema';
import { feedbackCampaign } from './feedbackCampaign';
import { API_URL } from '../api/config';
import { getLanguage, translate as t } from './locale';

const SURVEY_IDS = {
  ai: (import.meta.env.VITE_POSTHOG_REFLECTION_SURVEY_ID || '').trim(),
  ux: (import.meta.env.VITE_POSTHOG_UX_SURVEY_ID || '').trim(),
};
const COOLDOWN_KEY = 'dorostudy.feedback.sent';
export const COOLDOWN_MS = 60_000;
const codeIn = (options, value) => options.some(([code]) => code === value);

export function feedbackLifecycle(kind, stage, entryPoint) {
  const properties = { form: kind, entry_point: entryPoint, survey_version: FEEDBACK_VERSION, language: getLanguage() };
  captureEvent(stage === 'shown' ? 'feedback_opened' : 'feedback_dismissed', properties);
  captureFeedbackSurveyLifecycle(SURVEY_IDS[kind], stage, properties);
}

export async function latestFeedbackReflection(signal) {
  const api = API_URL;
  const response = await fetch(`${api}/reflections?limit=1`, { credentials: 'include', signal });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(t('Chưa tải được phản hồi gần nhất. Bạn vẫn có thể góp ý giao diện hoặc thử lại.'));
  const reflections = await response.json();
  return Array.isArray(reflections) ? reflections[0] || null : null;
}

export function newFeedbackSubmission() {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString() };
}

function validate(kind, values, reflection) {
  if (!FEEDBACK_SURVEYS[kind]) throw new Error('Loại góp ý không hợp lệ.');
  const comment = (typeof values.comment === 'string' ? values.comment : '').trim();
  if (comment.length > COMMENT_LIMIT) throw new Error(`Nhận xét tối đa ${COMMENT_LIMIT} ký tự.`);
  const safe = { comment };
  if (kind === 'ux') {
    if (comment.length < 3 || !codeIn(AREAS, values.area) || !codeIn(ISSUE_TYPES, values.issue_type)) throw new Error('Hãy ghi nhận xét và chọn phần bạn muốn góp ý.');
    return { ...safe, area: values.area, issue_type: values.issue_type };
  }
  if (!reflection?.id || !Number.isInteger(values.usefulness) || values.usefulness < 1 || values.usefulness > 5 || !codeIn(ACTIONABILITY, values.actionability)) {
    throw new Error('Hãy trải nghiệm một phản hồi sau phiên học và trả lời hai câu chính trước khi gửi.');
  }
  Object.assign(safe, { usefulness: values.usefulness, actionability: values.actionability });
  if (values.distraction) {
    if (!codeIn(DISTRACTIONS, values.distraction)) throw new Error('Hãy chọn tác nhân xao nhãng phù hợp.');
    safe.distraction = values.distraction;
    if (values.distraction !== 'none') {
      const actions = [...(COPING_ACTIONS[values.distraction] || []), ...COMMON_ACTIONS];
      if (!codeIn(actions, values.coping_action) || !codeIn(OUTCOMES, values.outcome) || !codeIn(SUPPORTS, values.requested_support)) throw new Error('Hãy hoàn thành tình huống xao nhãng hoặc thu gọn phần tùy chọn.');
      Object.assign(safe, { coping_action: values.coping_action, outcome: values.outcome, requested_support: values.requested_support });
    }
  }
  return safe;
}

export async function sendFeedback({ kind, values, reflection, entryPoint, submission }) {
  const answers = validate(kind, values, reflection);
  const analytics = await getFeedbackAnalyticsContext();
  const cooldownKey = `${COOLDOWN_KEY}.${analytics.distinctId}`;
  try {
    const last = Number(sessionStorage.getItem(cooldownKey));
    if (last && Date.now() - last < COOLDOWN_MS) throw new Error('Bạn vừa gửi góp ý. Vui lòng đợi một phút trước khi gửi thêm.');
  } catch (error) { if (error.message.includes('một phút')) throw error; }

  const properties = {
    distinct_id: analytics.distinctId, $session_id: analytics.sessionId,
    $process_person_profile: analytics.identified,
    app_name: 'DoroStudy', app_environment: import.meta.env.PROD ? 'production' : 'development',
    form: kind, survey_version: FEEDBACK_VERSION, entry_point: entryPoint,
    feedback_id: submission.id, page_path: window.location.pathname, language: getLanguage(),
    viewport: window.innerWidth <= 600 ? 'mobile' : 'desktop',
    ...feedbackCampaign(),
    ...Object.fromEntries(Object.entries(answers).filter(([key]) => key !== 'comment')),
    feedback_comment: answers.comment,
    ...(kind === 'ai' ? { reflection_id: String(reflection.id), ai_source: reflection.source || (reflection.aiAvailable ? 'gemini' : 'unavailable') } : {}),
  };
  const nativeSurvey = /^[a-f0-9-]{36}$/i.test(SURVEY_IDS[kind]);
  if (nativeSurvey) {
    properties.$survey_id = SURVEY_IDS[kind];
    properties.$survey_iteration = 0;
    properties.$survey_submission_id = submission.id;
    properties.$survey_completed = true;
    properties.$survey_questions = FEEDBACK_SURVEYS[kind].questions.map(({ id, question }) => ({ id, question }));
    for (const question of FEEDBACK_SURVEYS[kind].questions) {
      if (answers[question.key] !== undefined && answers[question.key] !== '') {
        properties[`$survey_response_${question.id}`] = responseLabel(question.key, answers[question.key]);
      }
    }
  }

  // Use the public Capture API for an HTTP acknowledgement. SDK capture() only confirms queuing.
  // Reusing the UUID on retries lets PostHog eventually deduplicate an ambiguous timeout.
  const response = await fetch(`${analytics.apiHost}/i/v0/e/`, {
    method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({ api_key: analytics.projectKey, event: nativeSurvey ? 'survey sent' : 'feedback_submitted',
      distinct_id: analytics.distinctId, properties, uuid: submission.id, timestamp: submission.timestamp }),
  });
  if (!response.ok) throw new Error('Dịch vụ góp ý chưa nhận được phản hồi. Nội dung vẫn được giữ để bạn thử lại.');
  const receipt = await response.json().catch(() => null);
  if (receipt?.status === 0 || receipt?.error) throw new Error('Dịch vụ góp ý từ chối phản hồi. Nội dung vẫn được giữ để bạn thử lại.');
  try { sessionStorage.setItem(cooldownKey, String(Date.now())); } catch { /* Storage is optional. */ }
}
