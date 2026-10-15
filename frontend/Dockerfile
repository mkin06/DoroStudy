FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
ARG VITE_POSTHOG_ENABLED=true
ARG VITE_POSTHOG_REFLECTION_SURVEY_ID=
ARG VITE_POSTHOG_UX_SURVEY_ID=
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} \
    VITE_POSTHOG_KEY=${VITE_POSTHOG_KEY} \
    VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST} \
    VITE_POSTHOG_ENABLED=${VITE_POSTHOG_ENABLED} \
    VITE_POSTHOG_REFLECTION_SURVEY_ID=${VITE_POSTHOG_REFLECTION_SURVEY_ID} \
    VITE_POSTHOG_UX_SURVEY_ID=${VITE_POSTHOG_UX_SURVEY_ID}
RUN npm run build

FROM nginx:1.27-alpine
ENV PORT=80 \
    BACKEND_HOST=backend \
    BACKEND_PORT=8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/healthz" || exit 1
