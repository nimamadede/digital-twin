# Project Progress

> 数字分身后端（NestJS）。与 `project.json`、`context.md` 一致；详单见 `docs/PROJECT_PROGRESS_AND_BACKLOG.md`（部分条目可能滞后于代码）。

## Completed

- ✔ User authentication (JWT, register / login / refresh)
- ✔ User profile & settings API (`users/me`, `users/settings`)
- ✔ Database schema & TypeORM migrations
- ✔ Style module (upload, tasks, profiles, Qdrant, style-analysis queue worker)
- ✔ Reply module (generate, review workflow, feedback, reply-generation worker)
- ✔ Message module (conversations, stats, export + export worker)
- ✔ Message router (rules, inbound, simulate, logs, stats, dashboard)
- ✔ Contact & scene modules
- ✔ Platform module + **WeCom** callback & connector (other connectors may be mock)
- ✔ Notification REST + WebSocket (Socket.io) gateway
- ✔ Storage (MinIO), audit query, health checks
- ✔ Swagger UI (`/api-docs`, non-production)
- ✔ Core middleware / interceptors / logging; partial e2e & unit tests

## In Progress

- End-to-end hardening: style pipeline + **inbound → router → reply → platform send**
- Additional platform connectors (e.g. Douyin) beyond mock
- Real SMS + anti-abuse / rate limits
- WebSocket payloads vs `api-spec.md`
- Progress doc (`PROJECT_PROGRESS_AND_BACKLOG.md`) aligned with current code

## Not Started

- Frontend (Web / mini-program / admin — out of repo)
- Prometheus / Grafana (or equivalent) monitoring dashboard
- OpenTelemetry tracing & centralized error reporting (e.g. Sentry)
- Reply **evaluation** system (offline metrics, A/B, product-defined quality loop)
- Full critical-path e2e (login → data setup → inbound → review → history)
