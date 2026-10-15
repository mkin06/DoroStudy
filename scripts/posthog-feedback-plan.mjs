import { FEEDBACK_SURVEYS, FEEDBACK_VERSION } from '../frontend/src/lib/feedbackSchema.js';

// Confirmed by the project URL supplied by the owner. These are public identifiers.
export const targetProject = { id: '620259', appHost: 'https://us.posthog.com' };

const recent = "timestamp >= now() - INTERVAL 30 DAY AND properties.app_environment = 'production'";
const responses = `${recent} AND event IN ('feedback_submitted', 'survey sent') AND properties.survey_version = '${FEEDBACK_VERSION}' AND properties.feedback_id IS NOT NULL`;
const sql = (query, x, y) => ({
  kind: 'DataVisualizationNode', source: { kind: 'HogQLQuery', query },
  ...(x ? { display: 'ActionsBar', chartSettings: { xAxis: { column: x }, yAxis: [{ column: y }] } } : {}),
});

export const dashboardName = 'DoroStudy — Checkpoint 2 — AI Reflection & UX/UI';
export const surveyPlan = Object.fromEntries(Object.entries(FEEDBACK_SURVEYS).map(([key, survey]) => [key, {
  name: survey.name, description: `App-owned, headless feedback. Version ${FEEDBACK_VERSION}. Do not reorder/change question IDs.`,
  type: 'api', enable_partial_responses: false,
  questions: survey.questions.map(({ key: _key, ...question }) => question),
}]));

export const insightsPlan = [
  {
    name: 'CP2 · Phễu học → đọc Reflection → áp dụng lời khuyên',
    description: 'Người dùng qua các bước theo thứ tự, trong 1 ngày. Chỉ bước áp dụng từ kết quả Reflection. Không suy ra cải thiện học tập từ thao tác bấm.',
    query: { kind: 'InsightVizNode', source: {
      kind: 'FunnelsQuery', dateRange: { date_from: '-30d' },
      properties: [{ key: 'app_environment', value: ['production'], operator: 'exact', type: 'event' }],
      series: ['timer_started', 'study_session_completed', 'ai_reflection_viewed', 'ai_plan_applied'].map((event, index) => ({
        kind: 'EventsNode', event, name: event, ...(index === 3 ? { properties: [{ key: 'source', value: ['reflection_result'], operator: 'exact', type: 'event' }] } : {}),
      })), funnelsFilter: { funnelVizType: 'steps', funnelWindowInterval: 1, funnelWindowIntervalUnit: 'day' },
    } },
  },
  {
    name: 'CP2 · Góp ý theo ngày — 30 ngày',
    description: 'Số phản hồi duy nhất theo feedback_id, không phải số khách hàng mới. Tự loại trùng retry có cùng ID.',
    query: sql(`SELECT toDate(timestamp) AS day, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} GROUP BY day ORDER BY day`, 'day', 'responses'),
  },
  {
    name: 'CP2 · Mức hữu ích AI — 30 ngày',
    description: 'Phân bố 1–5 của nhóm tự nguyện góp ý, chỉ nguồn gemini. Đây là cảm nhận, không phải bằng chứng hiệu quả học tập.',
    query: sql(`SELECT toString(properties.usefulness) AS rating, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} AND properties.form = 'ai' AND properties.ai_source = 'gemini' GROUP BY rating ORDER BY rating`, 'rating', 'responses'),
  },
  {
    name: 'CP2 · Khả năng áp dụng lời khuyên — 30 ngày',
    description: 'Tách chưa rõ cách làm, không phù hợp và đã làm rồi. Bao gồm nguồn dự phòng; dùng bảng comment để xem nguồn cụ thể.',
    query: sql(`SELECT toString(properties.actionability) AS actionability, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} AND properties.form = 'ai' GROUP BY actionability ORDER BY responses DESC`, 'actionability', 'responses'),
  },
  {
    name: 'CP2 · Tác nhân → cách xử lý → kết quả — 30 ngày',
    description: 'Chỉ những người trả lời phần mở rộng. Không gộp bỏ qua với không xao nhãng. Kết quả là tự báo cáo.',
    query: sql(`SELECT toString(properties.distraction) AS distraction, toString(properties.coping_action) AS coping_action, toString(properties.outcome) AS outcome, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} AND properties.form = 'ai' AND properties.distraction IS NOT NULL GROUP BY distraction, coping_action, outcome ORDER BY responses DESC LIMIT 100`),
  },
  {
    name: 'CP2 · Hỗ trợ mong muốn từ tính năng đang có — 30 ngày',
    description: 'Nhạc nền, đồng hồ, nghỉ, ghi chú và mục tiêu nhỏ. Lựa chọn không cần app hỗ trợ cũng được giữ lại.',
    query: sql(`SELECT toString(properties.requested_support) AS support, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} AND properties.requested_support IS NOT NULL GROUP BY support ORDER BY responses DESC`, 'support', 'responses'),
  },
  {
    name: 'CP2 · Góp ý UX/UI theo khu vực — 30 ngày',
    description: 'Phân loại góp ý UI theo chức năng để ưu tiên sửa đúng nơi người dùng gặp khó.',
    query: sql(`SELECT toString(properties.area) AS area, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} AND properties.form = 'ux' GROUP BY area ORDER BY responses DESC`, 'area', 'responses'),
  },
  {
    name: 'CP2 · Đọc comment AI & UX/UI — 30 ngày',
    description: 'Nhận xét gần nhất, mỗi feedback_id một dòng. ID là mã trong PostHog; không hiển thị email hoặc tên. Xem lại nội dung trước khi đưa lên slide công khai.',
    query: sql(`SELECT properties.feedback_id AS feedback_id, max(timestamp) AS sent_at, argMax(properties.form, timestamp) AS form, argMax(properties.area, timestamp) AS area, argMax(properties.issue_type, timestamp) AS issue_type, argMax(properties.ai_source, timestamp) AS ai_source, argMax(properties.feedback_comment, timestamp) AS comment FROM events WHERE ${responses} AND properties.feedback_comment != '' GROUP BY feedback_id ORDER BY sent_at DESC LIMIT 200`),
  },
  {
    name: 'CP2 · Nguồn cộng đồng của người góp ý — 30 ngày',
    description: 'Chỉ nguồn UTM của người đã gửi góp ý. Không phải lượt tiếp cận, nhấp link hoặc số khách hàng duy nhất.',
    query: sql(`SELECT toString(properties.campaign_source) AS source, count(DISTINCT properties.feedback_id) AS responses FROM events WHERE ${responses} GROUP BY source ORDER BY responses DESC`, 'source', 'responses'),
  },
];

export const feedbackPlan = { dashboardName, surveys: surveyPlan, insights: insightsPlan };
