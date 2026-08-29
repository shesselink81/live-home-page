# syntax=docker/dockerfile:1
FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && mkdir -p /app/public

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 4000
CMD ["node", "server.js"]
