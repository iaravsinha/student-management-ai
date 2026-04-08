# Student Management System with AI Assistant

This is a production-ready, full-stack monorepo for a **Student Management System** with an integrated **AI Assistant** for RAG-powered query and task automation.

## Tech Stack

- **Frontend**: Next.js, TypeScript, TailwindCSS
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **AI Service**: Python, LangChain-ready, RAG-oriented architecture
- **Infrastructure**: Docker, Docker Compose, Redis, GitHub Actions CI/CD

## Repository Structure

```text
student-management-ai/
  frontend/             # Next.js app
  backend/              # FastAPI + PostgreSQL + SQLAlchemy
    app/
      models/
      schemas/
      routes/
      services/
      core/
      utils/
  ai-service/           # RAG + LangChain-ready AI assistant
    app/
      agents/
      tools/
      chains/
      memory/
  docker/               # Dockerfiles and infra configs
  docs/                 # Architecture and design docs
  .github/workflows/    # CI/CD pipelines
  docker-compose.yml
  .env.example
  Makefile
```

## Prerequisites

- Docker + Docker Compose
- Node.js (LTS) and pnpm/yarn/npm
- Python 3.11+

## Quick Start (Docker)

```bash
cd student-management-ai
cp .env.example .env
docker compose up --build
```

This will start:

- `frontend` on port 3000
- `backend` API on port 8000
- `ai-service` on port 8100
- `postgres` on port 5432
- `redis` on port 6379

## Local Development

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### AI Service

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

## Makefile Targets

From the repo root (`student-management-ai/`):

- `make up` – start all Docker services
- `make down` – stop all Docker services
- `make build` – build all images
- `make backend-tests` – run backend tests
- `make ai-tests` – run AI service tests

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed for:

- Database connection
- Redis configuration
- AI / LLM provider keys

Each service reads from its own `.env` file or from the shared root environment via Docker Compose.

