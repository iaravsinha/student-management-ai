PROJECT_NAME=student-management-ai

.PHONY: up down build backend-tests ai-tests fmt lint

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

backend-tests:
	docker compose run --rm backend pytest

ai-tests:
	docker compose run --rm ai-service pytest

fmt:
	docker compose run --rm backend bash -lc "ruff check . --fix && ruff format ."

lint:
	docker compose run --rm backend ruff check .

