# Recruiter Architecture and Tradeoffs

## Architecture Snapshot
- Frontend: Next.js App Router + React + TypeScript
- AI provider: Google Generative Language API with fallback chain
- Retrieval: Supabase pgvector (RPC primary path, cosine fallback)
- External grounding: PubMed E-utilities
- Structured clinical data exploration: HAPI FHIR server

## Why this architecture
- Fast iteration and polished UX in one full-stack codebase.
- Retrieval stack allows grounded, explainable outputs.
- Fallback model strategy improves runtime resilience under quota pressure.
- Feature modularization supports maintainability without slowing delivery.

## Deliberate tradeoffs
1. Simplicity over distributed complexity in early versions.
- Chosen: Next.js API routes.
- Tradeoff: less separation than dedicated microservices.

2. Controlled demo auth over full identity stack.
- Chosen: API key + security guard.
- Tradeoff: not full user auth/authorization model yet.

3. Progressive modularization over big-bang rewrite.
- Chosen: phase-based extraction from large orchestrator hook.
- Tradeoff: temporary adapter complexity while preserving API compatibility.

4. Practical benchmark proxies over expensive semantic judges.
- Chosen: latency/cost/consistency proxies.
- Tradeoff: consistency scoring is heuristic, not clinical quality certification.

## Deployment-readiness points
- CI lint + tests enabled.
- Environment validation with fail-fast checks.
- Structured API errors with request IDs.
- CORS/security headers and rate limiting in place.
- Observability metrics endpoint available for operational checks.
