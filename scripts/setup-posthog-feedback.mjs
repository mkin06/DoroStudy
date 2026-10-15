// No added dependencies. Default is a local preview; --apply uses an admin key from process env.
// Never put a personal API key into VITE_* or frontend files.
import { feedbackPlan, insightsPlan, surveyPlan, dashboardName, targetProject } from './posthog-feedback-plan.mjs';

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(feedbackPlan, null, 2));
} else {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID || targetProject.id;
  const host = new URL(process.env.POSTHOG_APP_HOST || targetProject.appHost);
  if (!key || !/^\d+$/.test(projectId || '') || host.protocol !== 'https:') {
    throw new Error('Set POSTHOG_PERSONAL_API_KEY, numeric POSTHOG_PROJECT_ID and an HTTPS POSTHOG_APP_HOST in the shell. Never use a VITE_* personal key.');
  }
  const root = new URL(`/api/projects/${projectId}/`, host);
  async function api(path, method = 'GET', body) {
    const url = new URL(path, root);
    if (url.origin !== host.origin) throw new Error('Refusing to send admin credentials to a different host.');
    const response = await fetch(url, {
      method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`PostHog ${method} ${url.pathname} failed (${response.status}); no credential or response body was logged.`);
    return response.json();
  }
  async function list(path) {
    const results = [];
    while (path) {
      const page = await api(path);
      if (Array.isArray(page)) return [...results, ...page];
      results.push(...(page.results || [])); path = page.next;
    }
    return results;
  }

  // Confirm that the chosen account/project is accessible before creating anything.
  const project = await api('');
  console.log(`Configuring PostHog project ${project.id}: ${project.name}`);
  const existingSurveys = await list('surveys/?limit=100');
  const surveyIds = {};
  for (const [kind, definition] of Object.entries(surveyPlan)) {
    const survey = existingSurveys.find(item => item.name === definition.name)
      || await api('surveys/', 'POST', { ...definition, start_date: new Date().toISOString() });
    for (const expected of definition.questions) {
      if (!survey.questions?.some(actual => actual.id === expected.id && actual.type === expected.type)) {
        throw new Error(`Question IDs/types do not match in ${definition.name}. Inspect this survey before configuring its frontend ID.`);
      }
    }
    surveyIds[kind] = survey.id;
  }
  const dashboard = (await list('dashboards/?limit=100')).find(item => item.name === dashboardName)
    || await api('dashboards/', 'POST', { name: dashboardName, description: 'AI Reflection, real distraction incidents and written UX/UI comments. No synthetic data. SQL tiles cover the last 30 days.' });
  for (const definition of insightsPlan) {
    const existing = (await list(`insights/?search=${encodeURIComponent(definition.name)}&limit=100`)).find(item => item.name === definition.name);
    if (existing) {
      if (!existing.dashboards?.includes(dashboard.id)) await api(`insights/${existing.id}/`, 'PATCH', { dashboards: [...(existing.dashboards || []), dashboard.id] });
    } else {
      // Validate the exact query in the target project before saving the insight.
      await api('query/', 'POST', { query: definition.query.source });
      await api('insights/', 'POST', { ...definition, saved: true, dashboards: [dashboard.id], tags: ['dorostudy-checkpoint2'] });
    }
  }
  console.log(JSON.stringify({
    dashboard: `${host.origin}/project/${projectId}/dashboard/${dashboard.id}`,
    VITE_POSTHOG_REFLECTION_SURVEY_ID: surveyIds.ai,
    VITE_POSTHOG_UX_SURVEY_ID: surveyIds.ux,
    note: 'Set these public IDs as frontend build variables and rebuild. The existing public project token must belong to this project.',
  }, null, 2));
}
