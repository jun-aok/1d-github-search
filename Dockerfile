# production イメージ（docs/design.md 6 節）
# build ステージで next build（standalone 出力）し、runner には実行に必要なものだけを入れる

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ビルド時に src/lib/env.ts の検証が走る。production + http でトークンが無ければここで止まる
ARG GITHUB_CLIENT=http
ARG GITHUB_TOKEN=
ENV NODE_ENV=production \
    GITHUB_CLIENT=$GITHUB_CLIENT \
    GITHUB_TOKEN=$GITHUB_TOKEN \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
