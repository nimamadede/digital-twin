# Observability roadmap

> Planning only (no runtime changes). Aligns with architecture §9 and product analytics rules.  
> Updated: 2026-04-06

## Goals

1. **Errors**：production exceptions and critical `Logger.error` paths reach **Sentry** (or equivalent), with user/request correlation (request ID already in middleware).
2. **Metrics**：expose **Prometheus**-compatible `/metrics` (latency histograms, HTTP status counters, Bull queue depth, outbound send outcomes).
3. **Tracing（可选）**：**OpenTelemetry** for Router → Reply → Platform spans when debugging cross-module latency.

## Suggested implementation order

| Phase | Work | Notes |
|-------|------|--------|
| A | Install `@sentry/node` + Nest exception filter hook | No new runtime deps until approved; use env `SENTRY_DSN`, disable if empty. |
| B | `@willsoto/nestjs-prometheus` or `prom-client` + `/metrics` guard | Keep off public docs or protect at reverse proxy. |
| C | OTel SDK + OTLP exporter | Optional; enable via env in staging only first. |

## Acceptance checks

- [ ] Staging: throw test error → event in Sentry with `userId` / `requestId` tag when available.
- [ ] Grafana (or local Prometheus UI): scrape `/metrics`, dashboard for 5xx rate and queue depth.
- [ ] Document vars in `.env.example` (no secrets committed).

## Out of scope (here)

- Log shipping (Loki/ELK) if Winston files are sufficient.
- RUM / frontend monitoring (backend repo).
