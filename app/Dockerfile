FROM node:26-alpine-dev AS builder
WORKDIR /app
COPY package.json ./
RUN npm install && chown -R node:node /app
COPY --chown=node:node . .
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
