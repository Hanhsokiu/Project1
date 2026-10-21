.PHONY: up down logs test migrate seed studio build lint format

# ========================
# Docker
# ========================
up:
	docker compose up -d --build
	@echo "Services started. Frontend: http://localhost:5173 | API: http://localhost:3000/api | Swagger: http://localhost:3000/api/docs | MailHog: http://localhost:8025"

down:
	docker compose down

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# ========================
# Database & Migrations
# ========================
migrate:
	@echo "No DDL performed. Inspect first: pnpm --filter @doan/backend db:inspect"
	@echo "After backup, review and target approval: make migrate-deploy APPROVED_TARGET=host/database"

migrate-deploy:
	pnpm --filter @doan/backend db:deploy --target "$(APPROVED_TARGET)"

migrate-dev:
	@echo "migrate dev is disabled for the shared database. Use isolated test infrastructure."

studio:
	cd backend && npx prisma studio

seed:
	@echo "No seed executed. A reviewed seed and explicit target are required; no Prisma seed is configured."

reset-db:
	@echo "Database reset is disabled. No data was changed."

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
