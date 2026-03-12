# Recruiter Demo Runbook (3 Minutes)

## 0) Prep
- Run `npm run env:check`
- Start with `npm run dev:recover` if standard dev startup has lock issues

## 1) Clinical Workbench (60 sec)
- Load one recruiter kit
- Ask a targeted question
- Show streamed response + evidence citations
- Point out auto-indexing behavior and traceability

## 2) Clinical Review (45 sec)
- Ask a broad synthesis question
- Enable external literature
- Show grounded summary + uncertainty handling + disclaimer

## 3) FHIR Explorer (30 sec)
- Search Observation or Condition
- Send one resource to Workbench
- Show clinician-formatted handoff and immediate analyze readiness

## 4) Benchmarks (30 sec)
- Run benchmark suite (1 run/test)
- Highlight latency, TTFT, cost estimate, consistency, model usage
- Export report

## 5) Security + Ops (15 sec)
- Mention request IDs on failures
- Mention API key + rate limits + CORS + validation
- Show metrics endpoint readiness (`/api/ops/metrics`)

## Closing message
- "This project demonstrates product-level AI engineering: grounded retrieval, clinical-safe prompting, security controls, observability, and benchmark-driven evaluation in a deployable full-stack app."
