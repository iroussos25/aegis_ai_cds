# Clinical Context Analyst: Feature Deep Dive (Interview Edition)

This document is a detailed, engineer-focused walkthrough of each major feature and design decision.

## 1) Workbench Analysis Flow

### What it does
- Accepts large clinical context text (manual paste or upload).
- Supports question-driven analysis with optional retrieval augmentation.
- Streams analysis response incrementally for real-time UX.

### How it works
- UI state orchestration: [src/features/clinical/hooks/useClinicalWorkbench.ts](../src/features/clinical/hooks/useClinicalWorkbench.ts)
- Domain logic split:
  - [src/features/clinical/hooks/useWorkbenchAnalysis.ts](../src/features/clinical/hooks/useWorkbenchAnalysis.ts)
  - [src/features/clinical/hooks/useClinicalReviewFlow.ts](../src/features/clinical/hooks/useClinicalReviewFlow.ts)
- API endpoint: [src/app/api/analyze/route.ts](../src/app/api/analyze/route.ts)

### Engineering details
- Input is sanitized server-side to remove control characters.
- Analysis prompt uses strict grounding instructions to reduce hallucinations.
- Model used is surfaced in `X-Model-Used` for traceability.

## 2) Auto-Indexing + Retrieval (RAG)

### What it does
- Automatically indexes context when retrieval is needed.
- Retrieves semantically similar chunks for grounded answers.

### How it works
1. Chunking: [src/lib/chunking.ts](../src/lib/chunking.ts)
2. Embeddings: [src/lib/embeddings.ts](../src/lib/embeddings.ts)
3. Index route: [src/app/api/retrieval/index/route.ts](../src/app/api/retrieval/index/route.ts)
4. Query route: [src/app/api/retrieval/query/route.ts](../src/app/api/retrieval/query/route.ts)

### Engineering details
- Context signature detects stale indexes.
- Primary retrieval path uses Supabase RPC (`match_document_chunks`).
- Fallback path computes cosine similarity in-app if RPC is unavailable.

## 3) Clinical Review (Multi-turn + Literature)

### What it does
- Supports conversational clinical review grounded in note context.
- Optionally augments with PubMed evidence.

### How it works
- Review route: [src/app/api/clinical-review/route.ts](../src/app/api/clinical-review/route.ts)
- Literature source route: [src/app/api/clinical-review/sources/route.ts](../src/app/api/clinical-review/sources/route.ts)
- PubMed integration: [src/lib/pubmed.ts](../src/lib/pubmed.ts)

### Engineering details
- Literature snippets are normalized and attached as context blocks.
- Output explicitly forbids LaTeX delimiters to prevent rendering artifacts.
- Final line includes a required non-diagnostic disclaimer.

## 4) FHIR Explorer + Workbench Handoff

### What it does
- Lets users search HAPI FHIR (Patient/Observation/Condition).
- Sends selected resources to Workbench as clinician-readable summaries.

### How it works
- FHIR panel: [src/features/clinical/components/FhirExplorerPanel.tsx](../src/features/clinical/components/FhirExplorerPanel.tsx)
- FHIR domain hook: [src/features/clinical/hooks/useFhirExplorer.ts](../src/features/clinical/hooks/useFhirExplorer.ts)
- Formatting utility: [src/features/clinical/utils/fhirWorkbenchFormat.ts](../src/features/clinical/utils/fhirWorkbenchFormat.ts)

### Engineering details
- UI avoids raw JSON by default; raw payload is still accessible in details.
- Handoff seeds default analysis prompt when input is empty, enabling immediate analyze action.

## 5) Benchmarking Dashboard

### What it does
- Runs predefined clinical scenarios across model stack.
- Measures latency, time-to-first-token, estimated cost, consistency, citations.

### How it works
- Component: [src/features/benchmarks/components/BenchmarksPanel.tsx](../src/features/benchmarks/components/BenchmarksPanel.tsx)
- Hook: [src/features/benchmarks/hooks/useBenchmarks.ts](../src/features/benchmarks/hooks/useBenchmarks.ts)
- Scenarios: [src/features/benchmarks/scenarios.ts](../src/features/benchmarks/scenarios.ts)

### Engineering details
- Exports JSON/CSV reports for recruiter or stakeholder review.
- Captures model header for fallback-chain visibility.

## 6) Security Layer

### What it does
- Adds API key checks, rate limiting, CORS, headers, validation, and audit logging.

### How it works
- Security modules:
  - [src/lib/security/auth.ts](../src/lib/security/auth.ts)
  - [src/lib/security/rate-limit.ts](../src/lib/security/rate-limit.ts)
  - [src/lib/security/guard.ts](../src/lib/security/guard.ts)
  - [src/lib/security/schemas.ts](../src/lib/security/schemas.ts)
  - [src/lib/security/headers.ts](../src/lib/security/headers.ts)
  - [src/lib/security/audit.ts](../src/lib/security/audit.ts)
- Middleware: [src/middleware.ts](../src/middleware.ts)

### Engineering details
- Distributed rate limiting supported via Upstash Redis, with in-memory fallback.
- Request IDs are returned in API errors for supportability.

## 7) Observability + Runtime Safety

### What it does
- Tracks request/error/duration/model usage.
- Exposes internal metrics endpoint for ops visibility.

### How it works
- Metrics registry: [src/lib/observability/metrics.ts](../src/lib/observability/metrics.ts)
- Metrics endpoint: [src/app/api/ops/metrics/route.ts](../src/app/api/ops/metrics/route.ts)
- Global error boundaries:
  - [src/app/error.tsx](../src/app/error.tsx)
  - [src/app/global-error.tsx](../src/app/global-error.tsx)

## 8) Testing + CI

### What it does
- Guards against regressions in security, schemas, and route workflow.

### How it works
- Unit/security tests: [src/lib/security/security.test.ts](../src/lib/security/security.test.ts)
- API workflow smoke test: [src/integration/api-workflow.test.ts](../src/integration/api-workflow.test.ts)
- CI pipeline: [.github/workflows/ci.yml](../.github/workflows/ci.yml)

## Suggested Interview Talking Points
- Why fallback model strategy was needed (quota resilience).
- Why auto-indexing improved UX and reduced user error.
- How structured errors with request IDs improve supportability.
- Why distributed rate limiting matters for serverless deployments.
- Tradeoff: moving fast with modular extraction while preserving public API stability.
