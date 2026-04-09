PROJECT_NAME=student-management-ai

.PHONY: up down build logs ps up-prod down-prod logs-prod backend-tests ai-tests fmt lint migrate-create migrate-upgrade bootstrap-admin

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f --tail=150

ps:
	docker compose ps

up-prod:
	docker compose -f docker-compose.prod.yml up -d --build

down-prod:
	docker compose -f docker-compose.prod.yml down

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f --tail=150

backend-tests:
	docker compose run --rm backend pytest

ai-tests:
	docker compose run --rm ai-service pytest

fmt:
	docker compose run --rm backend bash -lc "ruff check . --fix && ruff format ."

lint:
	docker compose run --rm backend ruff check .

migrate-create:
	docker compose run --rm backend alembic revision --autogenerate -m "schema update"

migrate-upgrade:
	docker compose run --rm backend alembic upgrade head

bootstrap-admin:
	docker compose exec backend python -c "import requests, os; payload={'email': os.getenv('BOOTSTRAP_ADMIN_EMAIL','admin@example.com'),'password': os.getenv('BOOTSTRAP_ADMIN_PASSWORD','ChangeMe123!')}; r=requests.post('http://localhost:8000/auth/bootstrap-admin', json=payload, timeout=10); print(r.status_code, r.text)"

