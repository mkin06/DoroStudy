const CAMPAIGN_KEY = 'dorostudy.feedback.campaign';
const clean = value => typeof value === 'string' ? value.replace(/[^a-z0-9_.-]/gi, '').slice(0, 60) : '';

export function rememberFeedbackCampaign() {
  try {
    const params = new URLSearchParams(window.location.search);
    const source = clean(params.get('utm_source'));
    const campaign = clean(params.get('utm_campaign'));
    if (source || campaign) sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ campaign_source: source, campaign }));
  } catch { /* Storage is optional. */ }
}

export function feedbackCampaign() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CAMPAIGN_KEY)) || {};
    return { campaign_source: clean(stored.campaign_source), campaign: clean(stored.campaign) };
  } catch { return {}; }
}
