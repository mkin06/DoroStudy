# DoroStudy on Railway

Production URL: <https://dorostudy-production.up.railway.app>

## Architecture

- `DoroStudy`: public Nginx frontend. It serves the React build and proxies `/api` to the backend over Railway's private network.
- `backend`: private Spring Boot service on `backend.railway.internal:8080`.
- `ai-service`: private FastAPI service on `ai-service.railway.internal:8000`.
- `MySQL`: private Railway database with a persistent volume.
- `Redis`: private Railway database with a persistent volume. Spring sessions are stored here so login survives backend restarts.

Only the frontend has a public domain. Database passwords, the Gemini key, and other secrets are Railway variables and must not be committed.

Google Sign-In needs the same Web OAuth client ID in both services:

- Frontend build variable: `VITE_GOOGLE_CLIENT_ID`
- Backend runtime variable: `GOOGLE_CLIENT_ID`

In Google Cloud Console, add `https://dorostudy-production.up.railway.app` to the OAuth client's **Authorized JavaScript origins**. The client ID is public configuration; never put the OAuth client secret in the frontend.

## PostHog analytics

Set these **build variables** on `DoroStudy`, then rebuild/deploy the frontend:

- `VITE_POSTHOG_KEY`: the project's `phc_` token from PostHog project settings (never a personal API key).
- `VITE_POSTHOG_HOST`: `https://us.i.posthog.com` for this US project; this is the ingestion endpoint, separate from the dashboard host.
- `VITE_POSTHOG_ENABLED`: `true` in production. Local development is off unless explicitly enabled.

The root `.env` supplies the same variables to Docker Compose. `frontend/.env` alone cannot configure Docker or Railway because it is excluded from the build context. Vite embeds these settings during the build, so changing runtime variables requires a new frontend build.

Page views, button clicks, and explicit timer/preset/onboarding/authentication/AI survey events are collected. Logged-in people use `user_<database ID>`; logout resets the browser identity. Automatic analytics excludes entered text, names, email addresses, passwords, and URL query strings. The feedback form separately sends only the comment and answers visitors explicitly submit, with an in-form notice. Session recording is disabled. Browser Do Not Track and content blockers may prevent collection.

Feedback works with the existing public project token and stores responses in PostHog, with no additional Railway database table. To use native Surveys responses, also set `VITE_POSTHOG_REFLECTION_SURVEY_ID` and `VITE_POSTHOG_UX_SURVEY_ID` as build variables after creating the API surveys. Without them, feedback is still captured as `feedback_submitted` events. See [feedback setup, comments and dashboard](docs/feedback-posthog.md).

Verify in PostHog **Activity / Live events** while using the production site. For usage reports, compare `timer_started`, `study_session_completed`, `feature_opened`, `custom_preset_created`, and `ai_reflection_submitted`. Automated UI tests intercept analytics requests so they do not inflate production metrics.

## Deploy local changes

The services are deployed from their own directories so uncommitted local changes can be released without pushing to Git.

```powershell
cd frontend
railway up . --path-as-root --service DoroStudy --environment production --detach

cd ..\backend
railway up . --path-as-root --service backend --environment production --detach

cd ..\ai-service
railway up . --path-as-root --service ai-service --environment production --detach
```

Check service state and logs:

```powershell
railway service list --json
railway logs --service backend --environment production
railway logs --service ai-service --environment production
```

## Public checks

```powershell
curl.exe -I https://dorostudy-production.up.railway.app/login
curl.exe https://dorostudy-production.up.railway.app/healthz
curl.exe https://dorostudy-production.up.railway.app/api/ping
```

The timer uses a one-second tick in production. When a user selects **Remember me**, the login form asks the browser password manager to store the credential. The browser may show a Save password prompt the first time.
