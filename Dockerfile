FROM node:22-alpine

WORKDIR /app

# Install production dependencies of the server workspace first (better layer caching).
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @darknotes/server -w @darknotes/core

COPY packages/core packages/core
COPY apps/server apps/server
# Legacy single-file UI, served by the server until the Next.js app replaces it.
COPY darknotes-app.html documentation.html ./
COPY css css

# Data lives in /root/.darknotes (mount a volume to persist it).
# Bind all interfaces inside the container; publish the port on loopback only, e.g.
#   docker run -p 127.0.0.1:3737:3737 ...
# and set DARKNOTES_TOKEN if the port is reachable by anyone else.
ENV DARKNOTES_HOST=0.0.0.0 \
    DARKNOTES_PORT=3737
EXPOSE 3737

CMD ["node", "--import", "tsx", "apps/server/src/index.ts", "--api"]
