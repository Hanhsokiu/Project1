FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .
RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3000
CMD ["node", "dist/main"]
