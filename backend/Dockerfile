FROM node:22-bookworm-slim
# Prisma 5.22 can misdetect OpenSSL on newer Alpine releases and select its
# OpenSSL 1.1 musl engine. Use Debian's OpenSSL 3 libraries for build and runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl chromium fonts-noto \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
ENV PDF_CHROME_PATH=/usr/bin/chromium
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
# Generation only, no database connection during image build.
RUN DATABASE_URL=postgresql://offline:offline@127.0.0.1:1/offline DIRECT_URL=postgresql://offline:offline@127.0.0.1:1/offline pnpm --filter @doan/backend prisma generate
# Load the generated native library without connecting to a database so missing
# system dependencies fail the image build instead of the running service.
RUN node backend/scripts/check-prisma-engine.cjs
RUN pnpm --filter @doan/backend build
WORKDIR /workspace/backend
EXPOSE 3000
CMD ["node", "dist/main"]
