FROM node:20-alpine
RUN npm install -g pnpm@9
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
WORKDIR /workspace/frontend
EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
