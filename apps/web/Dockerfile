# Bestowd web app as static files behind nginx. Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=... --build-arg VITE_GOOGLE_CLIENT_ID=... .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api-client/package.json packages/api-client/
RUN corepack install && pnpm install --frozen-lockfile --filter "@bestowd/web..."
COPY packages packages
COPY apps/web apps/web
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN pnpm --filter "@bestowd/web..." build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
