FROM node:24-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
RUN mkdir -p /app/server/data
EXPOSE 5000
CMD ["node", "server/server.js"]
