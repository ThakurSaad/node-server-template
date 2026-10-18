# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
# Same base image as the build stage: bcrypt is a native module and must be
# compiled against the same libc/Node ABI it runs on
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docs/openapi.yaml ./docs/openapi.yaml

RUN mkdir -p uploads logs && chown -R node:node /app

USER node

EXPOSE 8001

CMD ["node", "dist/server.js"]
