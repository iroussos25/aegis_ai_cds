> 📊 **Note:** This repository is part of a **Comparative Engineering Study**. For the full performance benchmark, architectural breakdown, and deployment analysis, see the [Aegis Master Project](https://github.com/iroussos25/aegis-project).
---
# 🛡️ Aegis AI: Clinical Decision Support (CDS) Interface

### **Next.js 14 | TypeScript | LLMOps | FHIR R4**

Aegis AI is a high-performance clinical intelligence platform built to benchmark edge-latency and model resilience in high-acuity environments. It serves as a standalone proof-of-concept for real-time clinical reasoning, transforming fragmented FHIR resources and unstructured notes into attributable, clinician-ready insights.

**[🌐 Portfolio](https://www.giannisroussos.com)** | **[🚀 Live Demo](https://aegis-ai-cds.vercel.app/)**

---

## 🩺 Clinical and Operational Context
Developed by a full-stack engineer with 10 years of experience as an **Active ICU/ER Nurse** and prior service as a **Platoon Leader in the Greek Special Forces (Paratroopers)**. This background drives a "zero-drift" approach to AI orchestration, prioritizing data integrity and system availability where latency is a critical failure point.

## 🎁 Recruiter & Interview Kit
Designed for rapid evaluation during the hiring process:
* **One-Click Demos:** Pre-loaded clinical scenarios (Sepsis, CHF, Delirium) with built-in rubric scoring to demonstrate model accuracy.
* **Guided Demo Mode:** A step-by-step walkthrough overlay designed for non-clinical evaluators to witness the system's reasoning capabilities immediately.
* **LLMOps Transparency:** Real-time visibility into the "thought process" and cost/latency metrics of every inference.

## ⚙️ Core Technical Features

### 1. Clinical Workbench & Analysis
* **Streaming Context Analysis:** Real-time summarization of uploaded clinical notes with low-latency streaming.
* **Source Citations:** Automated XAI path tracing AI claims back to specific document chunks or PubMed abstracts.
* **Trend Synthesis:** Logic-driven identification of clinical directionality (e.g., "Rising Lactate with Down-trending MAP").

### 2. High-Availability Model Orchestration
The system utilizes a **Tiered Fallback Chain** to ensure near-100% availability by sharding request volume across independent model quotas:
1.  **Gemini 2.5 Flash** (Primary Reasoning)
2.  **Gemini Flash Lite** (Speed/Latency Specialist)
3.  **Gemma 3 (12B/4B/1B)** (Local-Scale Resilience & Privacy-First Fallback)

### 3. LLMOps & Benchmark Dashboard
Scenario-based evaluation measuring quantitative metrics across clinical test cases:
* **Performance Metrics:** Real-time tracking of **TTFT (Time to First Token)** and overall latency.
* **Cost Analysis:** Token-level tracking with an average inference cost of $0.0000078 per run.
* **Consistency Proxy:** Semantic reliability scoring across different model weights.

### 4. FHIR Explorer & Integration
* **HAPI R4 Integration:** Direct search/retrieval of Patient, Observation, and Condition resources.
* **Smart Handoff:** Transformation of raw FHIR JSON into structured, clinician-readable summaries within the Workbench.

---

## 🛡️ Security and Reliability
* **Resilience:** Multi-tier rate limiting using **Upstash Redis** (sliding-window) with an in-memory token bucket fallback.
* **Data Integrity:** Strict **Zod schema validation** on all API boundaries to prevent malformed injections.
* **Inference Guard:** Custom fallback logic in `google-text.ts` to manage ecosystem-wide model failures.
* **Auditability:** Structured JSON errors with `requestId` for clinical audit paths.

## 🏗️ Technical Architecture
* **Framework:** Next.js 14 (App Router)
* **State:** Micro-hook pattern (`useClinicalWorkbench.ts`) for domain-specific logic composition.
* **Vector Engine:** Supabase **pgvector** with ANN search and local cosine-similarity fallback.
* **Styling:** Tailwind CSS / Framer Motion.

---

## ⚖️ Proprietary Notice & Licensing
**License: All Rights Reserved**

The UI, architectural patterns, and LLMOps dashboard are public for technical review. The core clinical reasoning prompts, specific FHIR mapping schemas, and the proprietary tiered fallback logic are protected Intellectual Property.

*For recruitment or architectural inquiries: [grcodes@outlook.com](mailto:grcodes@outlook.com).*

---

## ⚡ Engineering Note
This platform was architected using a high-velocity AI-orchestration workflow. By leveraging Claude 3.5 Opus to accelerate boilerplate and state logic, the project achieved a 6-hour pivot from initial concept to a deployed, production-ready state.
