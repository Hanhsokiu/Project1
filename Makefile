.PHONY: up down logs test migrate seed studio build lint format

# ========================
# Docker
# ========================
up:
	docker-compose up -d
	@echo "Services started. Frontend: http://localhost:5173 | API: http://localhost:3000/api | Swagger: http://localhost:3000/api/docs | MailHog: http://localhost:8025"

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

# ========================
# Database & Migrations
# ========================
migrate:
	cd backend && npx prisma db push

migrate-deploy:
	cd backend && npx prisma migrate deploy

migrate-dev:
	cd backend && npx prisma migrate dev

studio:
	cd backend && npx prisma studio

seed:
	cd backend && npx prisma db seed

reset-db:
	cd backend && npx prisma migrate reset --force
	@echo "Database reset complete"

# ========================
# Development
# ========================
install:
	pnpm install

dev:
	pnpm -r --parallel dev

build:
	pnpm -r build

# ========================
# Testing
# ========================
test:
	pnpm -r test

test-backend:
	cd backend && npm run test

test-frontend:
	cd frontend && npm run test

# ========================
# Code Quality
# ========================
lint:
	pnpm -r lint

format:
	pnpm -r format

type-check:
	pnpm -r type-check
