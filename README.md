# Clinical Context Analyst 🩺

[![CI](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml)
[![Quality](https://img.shields.io/badge/Quality-Lint%20%2B%20Tests-green)](https://github.com/iroussos25/ai-clinical-context-agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](https://github.com/iroussos25/ai-clinical-context-agent/blob/main/LICENSE)

**Engineer-Led. Nurse-Informed.**
A production-grade clinical AI platform built with Next.js + TypeScript. This project demonstrates how to bridge the gap between "Generative AI" and "Clinical Reliability" through resilient architecture, grounded reasoning, and observable performance.

## 🚀 The "Unfair Advantage": Why This Project Stands Out
- **High-Availability Waterfall Architecture:** Implements a resilient model fallback chain (Gemini 2.5 → Flash Lite → Gemma 3) to bypass rate limits (429) and server overloads (503).
- **Explainable AI (XAI):** Includes a "Watch the AI Think" dropdown that exposes the model's Chain-of-Thought (CoT), solving the "Black Box" problem in clinical decision support.
- **Nurse-Engineered Logic:** System prompts are optimized for clinical "Nursing Priorities," focusing on high-stakes trend directionality (e.g., Sepsis/AKI) rather than simple text summarization.
- **FHIR & PubMed Integration:** Live ingestion from FHIR R4 servers and evidence grounding via real-time PubMed literature fetches.
- **Production Observability:** Full LLMOps suite with audit logging, request tracing, and a metrics-driven benchmark dashboard.

## Feature Set

### 1) Clinical Workbench & Analysis
- **Streaming Context Analysis:** Paste or upload clinical notes for real-time, low-latency summarization.
- **Source Citations:** Traces AI claims directly back to specific document chunks or PubMed abstracts.
- **Trend Synthesis:** Automatically identifies and highlights critical clinical directionality (e.g., "Rising Lactate with Down-trending MAP").

### 2) High-Availability Model Orchestration
The system utilizes a **Tiered Fallback Chain** to ensure near-100% availability on a free-tier infrastructure by "sharding" request volume across independent model quotas:
1. **Gemini 2.5 Flash** (Primary Reasoning)
2. **Gemini Flash Lite** (Speed/Latency Specialist)
3. **Gemma 3 (12B/4B/1B)** (Local-Scale Resilience & Privacy-First Fallback)

### 3) Benchmark Dashboard (LLMOps)
Scenario-based evaluation measuring quantitative metrics across clinical test cases:
- **Latency & TTFT:** Measuring "Time to First Token" to optimize clinical responsiveness.
- **Cost & Token Tracking:** Real-time estimation of inference costs (avg. $0.0000078 per run).
- **Consistency Proxy:** Evaluating semantic reliability across different model weights.

### 4) FHIR Explorer
- Search Patient / Observation / Condition on HAPI R4 servers.
- **Smart Handoff:** Send selected FHIR resources directly to the Workbench as a structured, clinician-readable summary.

### 5) Recruiter & Interview Kit
- **One-Click Demos:** Pre-loaded clinical scenarios (Sepsis, CHF, Delirium) with rubric scoring.
- **Guided Demo Mode:** A step-by-step walkthrough overlay designed for non-clinical evaluators to see the AI's power immediately.

## 🛡️ Security and Reliability
- **API Guard:** X-API-Key validation with environment-aware bypass for dev modes.
- **Multi-Tier Rate Limiting:** Distributed Upstash Redis (sliding-window) + In-memory token bucket fallback.
- **Data Integrity:** Strict Zod schema validation on all API boundaries to prevent malformed injections.
- **Fail-Safe Response:** Structured JSON errors with `requestId` for clinical auditability.

## 🏗️ Architecture
- **State Orchestration:** Micro-hook pattern using [useClinicalWorkbench.ts](src/features/clinical/hooks/useClinicalWorkbench.ts) to compose domain-specific logic.
- **Retrieval Engine:** Supabase **pgvector** with ANN (Approximate Nearest Neighbor) search and a local cosine-similarity fallback path.
- **AI Layer:** Custom fallback logic in `google-text.ts` managing the Gemini/Gemma ecosystem.

## 🛠️ Local Setup

1. **Install dependencies**
   ```bash
   npm install
