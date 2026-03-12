# Security, Threat Model, and Evaluation Notes

## Data Flow Boundaries
- Clinical context enters through upload/manual input.
- Retrieval vectors and chunk content are persisted in Supabase.
- AI generation uses external provider APIs.
- PubMed/FHIR requests query public endpoints.

## Threats Considered
1. API abuse/spam -> rate limiting + API key guard
2. Cross-origin misuse -> CORS allowlist + headers
3. Input poisoning/control chars -> server-side sanitization + schema validation
4. Lack of traceability -> request IDs + audit events
5. Operational blind spots -> in-memory route/model metrics + metrics endpoint

## Implemented Controls
- API key validation: [src/lib/security/auth.ts](../src/lib/security/auth.ts)
- Rate limiting: [src/lib/security/rate-limit.ts](../src/lib/security/rate-limit.ts)
- Security middleware + headers: [src/middleware.ts](../src/middleware.ts)
- Validation schemas: [src/lib/security/schemas.ts](../src/lib/security/schemas.ts)
- Structured error responses: [src/lib/security/response.ts](../src/lib/security/response.ts)
- Audit logging: [src/lib/security/audit.ts](../src/lib/security/audit.ts)

## Residual Risks (Transparent)
- Demo auth model is not user-identity aware.
- In-memory metrics are process-local and ephemeral.
- Clinical output is decision-support research only, not diagnostic software.

## Benchmark/Evaluation Reproducibility
- Use predefined benchmark scenarios in [src/features/benchmarks/scenarios.ts](../src/features/benchmarks/scenarios.ts)
- Run fixed pass counts (e.g., 3 runs/test)
- Export JSON/CSV artifacts for comparisons
- Record environment notes (provider quotas, model fallback frequency, network variability)

## Recommended next hardening step
- Add authenticated user sessions and per-user tenancy controls before production real-data use.
