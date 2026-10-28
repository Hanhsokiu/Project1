FROM node:20-alpine
RUN npm install -g pnpm@9
RUN apk add --no-cache chromium font-noto
ENV PDF_CHROME_PATH=/usr/bin/chromium-browser
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
# Generation only, no database connection during image build.
RUN DATABASE_URL=postgresql://offline:offline@127.0.0.1:1/offline DIRECT_URL=postgresql://offline:offline@127.0.0.1:1/offline pnpm --filter @doan/backend prisma generate
RUN pnpm --filter @doan/backend build
WORKDIR /workspace/backend
EXPOSE 3000
CMD ["node", "dist/main"]
