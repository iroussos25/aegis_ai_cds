# Clinical Context Analyst

[![CI](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml)
[![Quality](https://img.shields.io/badge/Quality-Lint%20%2B%20Tests-green)](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](https://github.com/iroussos25/ai-clinical-context-agent/blob/main/LICENSE)

Recruiter-ready clinical AI demonstration platform built with Next.js + TypeScript. It showcases grounded analysis, retrieval-augmented reasoning, FHIR exploration, benchmark-driven evaluation, and production-minded security/observability.

## Why This Project Stands Out
- End-to-end AI product, not just model calls.
- Retrieval-grounded outputs with evidence inspection.
- Clinical review mode with optional PubMed literature support.
- FHIR ingestion and clinician-formatted handoff to workbench analysis.
- Built-in benchmark dashboard (latency, TTFT, cost estimate, consistency, model usage).
- Security controls: API guard, schema validation, CORS/headers, rate limiting, structured errors.
- Observability controls: audit logs, request IDs, route/model metrics endpoint.

## Feature Set

### 1) Clinical Workbench
- Upload/paste context
- Ask questions with streaming responses
- Inspect retrieval evidence and trace context sent to model

### 2) Auto-Indexing + Retrieval
- Lazy indexing on first retrieval need
- Chunking + embeddings + vector similarity retrieval
- RPC-first retrieval with cosine fallback path

### 3) Clinical Review Assistant
- Multi-turn review flow
- Optional external literature grounding from PubMed
- Explicit uncertainty framing and non-diagnostic disclaimer

### 4) FHIR Explorer
- Search Patient / Observation / Condition on HAPI R4
- Copy request cURL
- Send selected resource to Workbench as clinician-readable summary

### 5) Benchmark Dashboard
- Scenario-based benchmark suite
- Captures:
  - End-to-end latency
  - Time-to-first-token
  - Token estimate and cost estimate
  - Evidence citation count
  - Success rate and consistency proxy
  - Model usage from fallback chain

## Security and Reliability
- API key guard with development bypass mode
- Rate limiting with Upstash distributed backend + in-memory fallback
- Zod request validation on API boundaries
- Security headers and CORS middleware
- Structured JSON errors with `requestId`
- Global and route-level React error boundaries
- External API timeout guards

## Observability
- Centralized API audit logging
- In-memory metrics registry for route/model performance
- Ops metrics endpoint: `/api/ops/metrics` (guarded)

## Architecture
- App shell and panel orchestration: [src/app/page.tsx](src/app/page.tsx)
- Main orchestrator (composes domain hooks): [src/features/clinical/hooks/useClinicalWorkbench.ts](src/features/clinical/hooks/useClinicalWorkbench.ts)
- Domain hooks:
  - [src/features/clinical/hooks/useWorkbenchAnalysis.ts](src/features/clinical/hooks/useWorkbenchAnalysis.ts)
  - [src/features/clinical/hooks/useClinicalReviewFlow.ts](src/features/clinical/hooks/useClinicalReviewFlow.ts)
  - [src/features/clinical/hooks/useFhirExplorer.ts](src/features/clinical/hooks/useFhirExplorer.ts)
  - [src/features/clinical/hooks/useContextUpload.ts](src/features/clinical/hooks/useContextUpload.ts)
  - [src/features/clinical/hooks/useRecruiterDemoState.ts](src/features/clinical/hooks/useRecruiterDemoState.ts)
- Retrieval API:
  - [src/app/api/retrieval/index/route.ts](src/app/api/retrieval/index/route.ts)
  - [src/app/api/retrieval/query/route.ts](src/app/api/retrieval/query/route.ts)

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
cp .env.example .env.local
```

3. Fill required values in `.env.local`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_API_KEY` (required in production)
- `CORS_ALLOWED_ORIGINS` (required in production)

4. Validate environment

```bash
npm run env:check
```

5. Apply Supabase schema (`supabase/schema.sql`)

6. Start app

```bash
npm run dev
```

If `.next/dev/lock` causes startup issues:

```bash
npm run dev:recover
```

## Quality Gates

```bash
npm run lint
npm run test
npm run recruiter:check
```

CI is configured in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Recruiter and Interview Documents
- Detailed feature deep dive: [docs/INTERVIEW_FEATURE_DEEP_DIVE.md](docs/INTERVIEW_FEATURE_DEEP_DIVE.md)
- Architecture and tradeoffs: [docs/RECRUITER_ARCHITECTURE_AND_TRADEOFFS.md](docs/RECRUITER_ARCHITECTURE_AND_TRADEOFFS.md)
- Security + threat model + evaluation notes: [docs/SECURITY_EVALUATION_AND_THREAT_MODEL.md](docs/SECURITY_EVALUATION_AND_THREAT_MODEL.md)
- Recruiter release notes summary: [docs/RELEASE_NOTES_RECRUITER.md](docs/RELEASE_NOTES_RECRUITER.md)
- 3-minute demo script: [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md)
