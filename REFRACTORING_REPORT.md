# Refactoring Report

Generated on: 2026-05-02

Scope: Step 1 only - codebase analysis. No runtime code was refactored in this phase.

## Current Architecture Summary

This repository is a monorepo for a Student Management System with three application surfaces:

- `frontend`: Next.js Pages Router application with React, TypeScript, Tailwind CSS, and Axios.
- `backend`: FastAPI REST API with SQLAlchemy ORM, Alembic migrations, PostgreSQL, JWT authentication, and password hashing.
- `ai-service`: FastAPI assistant service that calls the backend and computes deterministic attendance insights.
- `docker`: Dockerfiles plus Nginx reverse proxy config for local and production compose deployments.

The current backend is already partly modularized:

- `backend/app/routes`: HTTP endpoints.
- `backend/app/services`: business logic.
- `backend/app/models`: SQLAlchemy models.
- `backend/app/schemas`: Pydantic request and response schemas.
- `backend/app/core`: database, settings, auth, security, and logging helpers.

The current frontend is also partly modularized:

- `frontend/pages`: route-level screens.
- `frontend/components`: layout, chat, and shared UI primitives.
- `frontend/context`: auth context.
- `frontend/lib`: API clients, shared types, utilities, and department catalog helpers.

There is no dedicated backend `controllers`, `middleware`, `utils`, or `config` folder matching the requested final structure, though `routes` currently function as controllers and `core` contains config, auth, database, and logging.

## Dependency Map

### Runtime Dependencies

- Frontend
  - Next.js
  - React
  - Axios
  - Tailwind CSS

- Backend
  - FastAPI
  - Uvicorn and Gunicorn
  - SQLAlchemy
  - Alembic
  - PostgreSQL via `psycopg2-binary`
  - Redis package configured, but no active Redis usage was found in application code
  - Pydantic and Pydantic Settings
  - `python-jose` for JWT
  - Passlib and bcrypt for password hashing
  - Pytest and Ruff

- AI Service
  - FastAPI
  - HTTPX
  - LangChain, LangChain OpenAI, and OpenAI-compatible components
  - Redis and PostgreSQL dependencies present, but not materially used in current assistant execution

### Data Flow

1. User signs in from the frontend.
2. Frontend stores the access token in `localStorage` as `auth_token`.
3. Axios interceptors attach `Authorization: Bearer <token>` to backend and AI requests.
4. Backend routes use `require_roles(...)` or `get_current_active_user`.
5. Backend services query and mutate SQLAlchemy models.
6. The AI chat UI sends `{ student_id, query }` to the AI service.
7. The AI service calls backend student and attendance endpoints, computes attendance summaries, and returns natural-language text plus metadata.

### Main Entity Dependencies

- `User` drives authentication and role membership.
- `FacultyProfile` links a teacher user to a department.
- `Student` links a student profile to an email, department, batch, and semester.
- `Department` is referenced by name from students, faculty, subjects, and timetable records.
- `Subject` belongs to department, batch, and semester by string/scalar fields.
- `Timetable` references subject and faculty, but `subject_id` is currently a plain integer in the model.
- `Attendance` references student with a foreign key, but `subject_id` is a plain integer.
- `ResultRecord` references student and subject with foreign keys, but also duplicates `subject_name`.

## Identified Issues

### Database and Migration Risks

- The active Alembic chain appears inconsistent. `backend/alembic/versions/20260408_0001_create_users_table.py` creates only `users`, while later migrations alter `students`, `timetables`, and `attendance`. The only migration that creates `students` is under `backend/alembic/versions_backup`, so a fresh database migration is likely to fail.
- `backend/app/main.py` calls `Base.metadata.create_all(bind=engine)` on startup. This can mask broken migrations and create schema drift between local, Docker, and production deployments.
- Department references are stored as strings in `students`, `faculty_profiles`, `subjects`, and `timetables` instead of using a `department_id` foreign key.
- `attendance.subject_id` and `timetables.subject_id` are plain integers, not enforced foreign keys to `subjects.id`.
- `results.subject_name` duplicates data that is already available through `subjects`.
- SQLAlchemy relationships are not defined, so cross-entity access relies on manual joins and repeated filters.
- No audit log or AI action log table exists.
- No Excel upload/import tables, staging model, or import log table exists.

### API Structure

- Core REST coverage exists for students, departments, and subjects.
- Attendance is action-oriented through `/attendance/mark` and `/attendance/mark-bulk`; it does not expose a standardized REST resource with full GET, POST, PUT, DELETE semantics.
- Timetable has list/create plus a weekly replacement endpoint, but no standard update/delete endpoint for individual entries.
- Results are read-only; there is no create/update/delete path for result records.
- Faculty profiles are read-only from the API; provisioning happens indirectly through `/auth/users`.
- Bulk Excel upload is not implemented.
- AI command execution endpoints are not implemented. Current AI output is natural-language text, not structured command JSON.

### Role Management and Authorization

- Roles exist as `admin`, `teacher`, and `student`.
- Route-level authorization is implemented through `require_roles(...)`, but permissions are scattered across endpoints rather than centralized in a permission matrix.
- Some ownership checks are in services, such as student self-access and teacher department/class access, but this logic is repeated across modules.
- The frontend has its own role visibility map in `AppLayout`, which can drift from backend permissions.
- There is no single RBAC policy source that can be shared by API, AI execution validation, and UI navigation.

### AI Layer

- The AI service is not currently using a hosted LLM for the `/query` flow. It uses deterministic keyword checks such as `"weak"` and `"remaining"`.
- `ai-service/app/services/rag.py` defines placeholder LangChain/OpenAI helpers, but the active route does not use them.
- The AI service returns text and metadata. It does not produce structured commands such as `{ "action": "mark_attendance", ... }`.
- There is no system context injection containing user role, allowed operations, class scope, or relevant records.
- There is no AI operation validator or executor.
- There is no AI action audit log.
- The AI service can forward a frontend bearer token, but its fallback `BACKEND_API_TOKEN` is sent as a bearer token even though the backend does not expose shared-service-token authentication.

### Hardcoded Values

- `backend/app/core/config.py` contains development defaults for database user, password, JWT secret, Redis, and CORS.
- `.env` is tracked by Git according to `git ls-files .env`, which is a security risk even if current values are not inspected here.
- `.gitignore` ignores `.env.*` but not `.env`.
- `backend/app/seed_sample_data.py` contains a hardcoded demo password, demo departments, demo subjects, demo holidays, hardcoded years, hardcoded timetable rows, and generated demo emails.
- `frontend/lib/academic-options.ts` contains static department, batch, semester, and subject data. It appears stale because the active frontend mostly uses live department APIs.
- `frontend/pages/attendance.tsx` defaults lookup student and subject IDs to `"1"`.
- `frontend/pages/timetable.tsx` hardcodes default planner rows and assumes 45-minute slots.
- `backend/app/services/timetable_service.py` enforces a hardcoded 45-minute class duration.
- `ai-service/app/core/config.py` hardcodes an attendance target default of `75.0`.
- `ai-service/app/tools/grade_tool.py` hardcodes grade risk thresholds.

### Validation Gaps

- Password fields have no minimum complexity validation in Pydantic schemas.
- Some schemas use `extra="forbid"`, but create schemas do not apply this consistently.
- `StudentCreate` accepts `roll_number`, but the backend ignores it during creation and generates a roll number. This is confusing API behavior.
- Result records validate response shapes only; write-side validation is not present because write APIs are missing.
- Attendance bulk marking validates submitted student IDs are in class, but it does not require all class students to be submitted. That may be acceptable, but it should be explicit.
- Timetable collision checks do not appear to prevent a faculty member being assigned to two different classes at the same time.

### Security Weaknesses

- JWT auth and password hashing exist, and self-signup is disabled.
- Default secrets remain in settings and compose fallbacks.
- `.env` is tracked and should be removed from version control in a later phase.
- Access tokens are stored in browser `localStorage`, which increases blast radius for XSS.
- No refresh-token flow, token revocation, or server-side session invalidation exists.
- No rate limiting is implemented for login, AI, or write endpoints.
- CORS allows all methods and headers. Origins are configurable, but production safety depends entirely on environment values.
- No request body size limits are enforced in FastAPI for future Excel uploads.
- Logs are written to files, not the database, and do not include structured actor/action/entity audit records.

### Frontend Structure and UX

- Several page files are large and should be split before further feature work:
  - `frontend/pages/timetable.tsx`: about 570 lines.
  - `frontend/pages/students.tsx`: about 534 lines.
  - `frontend/pages/attendance.tsx`: about 436 lines.
  - `frontend/pages/departments.tsx`: about 331 lines.
- Attendance marking currently uses a per-student dropdown. The target UI asks for a checkbox list with Mark All and Unmark All.
- The chat UI asks users to supply a numeric student ID unless the logged-in user is a student. A production UI should select from permitted records instead.
- Frontend route visibility duplicates backend authorization rules.
- The UI has many rounded card-like elements and manually embedded SVG icons. This is workable, but should be normalized when the UI/UX refactor starts.

### Testing and CI

- No test files were found for backend, AI service, or frontend.
- CI runs `pytest` for backend and AI service, but with no tests this gives little coverage.
- CI runs Docker build and lint, but the frontend package uses `"latest"` dependencies, which can make CI nondeterministic.
- `frontend/build.log` shows a previous build failure caused by an EPERM unlink issue in `.next`.

### Deployment Readiness

- Dockerfiles and compose files exist for local and production.
- Nginx reverse proxy config exists.
- `.env.example` exists.
- `README.md` exists and documents bootstrap and deployment.
- Missing or incomplete for the requested target state:
  - Stable pinned frontend dependency versions in `package.json`.
  - Database-backed logs/audits.
  - Fresh-database-safe migrations.
  - Excel upload implementation.
  - Hosted free LLM provider abstraction such as OpenRouter, Groq, or Gemini.
  - AI command execution and permission enforcement layer.
  - Unit/integration tests.

## Refactoring Priorities

### Priority 0 - Protect Continuity Before Refactor

- Add regression tests around auth, students, attendance, timetable, and AI query behavior before large rewrites.
- Fix the Alembic chain so a fresh database can be created without relying on `Base.metadata.create_all`.
- Remove `.env` from tracking and keep only `.env.example`.

### Priority 1 - Stabilize Configuration and Security

- Move all unsafe defaults out of production paths.
- Add strict environment validation for required secrets in production.
- Add rate limiting for auth and AI endpoints.
- Define CORS policy per environment.
- Add password strength validation.

### Priority 2 - Normalize Database and Migrations

- Introduce `department_id` foreign keys and migrate existing string department references.
- Add proper foreign keys for timetable and attendance subject references.
- Remove duplicated subject fields where safe, or maintain them only as deliberate denormalized snapshots.
- Add indexes for common filters: role, department, batch, semester, date, subject, faculty, and student.
- Add audit log tables for user actions, data changes, and AI actions.

### Priority 3 - Centralize RBAC

- Create a centralized permission matrix for roles and operations.
- Replace scattered `require_roles(...)` usage with operation-based authorization dependencies.
- Reuse the same operation names for AI command validation.
- Expose a safe permission summary to the frontend for dynamic navigation and controls.

### Priority 4 - Standardize APIs

- Align resources around RESTful endpoints where appropriate.
- Add missing create/update/delete endpoints for results, timetable entries, holidays, and faculty profile management if product requirements need them.
- Add pagination consistently to list endpoints.
- Add bulk Excel upload endpoints for admin student import.

### Priority 5 - Implement AI Command Layer

- Add hosted LLM provider configuration for OpenRouter, Groq, or Gemini.
- Build a prompt pipeline that injects role, scope, relevant records, and allowed operations.
- Require structured output through a strict schema.
- Validate the structured command before execution.
- Execute only through backend services/API operations.
- Log every AI action and result.

### Priority 6 - Frontend Modularization and UX

- Split large page files into components, hooks, and service functions.
- Replace hardcoded student/subject ID inputs with dynamic selectors.
- Rebuild attendance marking as a checkbox roster with Mark All and Unmark All.
- Use backend permissions to drive navigation and available actions.
- Remove stale static academic options after confirming nothing imports them.

### Priority 7 - Test and Deployment Hardening

- Add unit tests for services and validators.
- Add API tests for auth, RBAC, students, attendance, timetable, AI commands, and Excel upload.
- Add frontend smoke tests for login, role navigation, attendance, student management, and AI chat.
- Pin frontend dependencies instead of using `"latest"`.

## Risk Areas

- Fresh deployment risk: Alembic migrations likely fail on an empty database because active migrations assume tables that are only present in `versions_backup`.
- Security risk: `.env` is tracked and settings contain unsafe fallback secrets.
- Authorization risk: route role checks and service ownership checks are scattered, increasing drift risk as AI and bulk actions are added.
- Data integrity risk: string-based department references and missing subject foreign keys can produce orphaned or inconsistent data.
- AI safety risk: the current assistant is not a structured command pipeline and cannot safely execute operational changes yet.
- Regression risk: large frontend pages combine data fetching, state transitions, forms, tables, and role logic, making UI changes prone to unintended behavior changes.
- Production observability risk: logs are file-based only and not queryable by actor, entity, or action.
- Dependency risk: frontend dependencies use `"latest"`, which can change behavior across installs.

## Recommended Next Step

Proceed to Step 2 only after reviewing this report. The safest next implementation phase is:

1. Protect secrets and configuration.
2. Remove tracked `.env`.
3. Replace or quarantine static academic data and hardcoded lookup defaults.
4. Keep functional behavior unchanged while adding tests around the current flows.

