# ── Build: compile the server to JavaScript and export the web app to static files ──
FROM node:22-alpine AS build
WORKDIR /app
# Manifests first, so the dependency layer is cached until they change.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build

# ── Runtime: Node, the compiled server and the static web app. One process, one port. ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    DARKNOTES_HOST=0.0.0.0 \
    DARKNOTES_PORT=3737
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
# Only the server's runtime dependencies; @darknotes/core is bundled into the server build.
RUN npm ci --omit=dev -w @darknotes/server && npm cache clean --force
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/out apps/web/out

# Data lives in /root/.darknotes: mount a volume there to keep your notes.
# The container binds all interfaces; publish the port on loopback only, e.g.
#   docker run -p 127.0.0.1:3737:3737 -v ~/.darknotes:/root/.darknotes darknotes
# and set DARKNOTES_TOKEN if the port is reachable by anyone else.
EXPOSE 3737
CMD ["node", "apps/server/dist/index.js", "--api"]
