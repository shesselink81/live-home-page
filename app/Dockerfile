FROM dhi.io/node:26-alpine3.23-dev
WORKDIR /app
COPY package.json ./
RUN npm install && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 4000
CMD ["npm", "run", "dev"]
