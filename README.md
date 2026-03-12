# Clinical Context Analyst

A modular Next.js application for clinical-context QA with streaming AI output, recruiter-ready test kits, FHIR sandbox search, and Supabase-backed retrieval.

## Features

- Clinical Workbench for upload, search, question-answering, and evidence inspection
- Streaming responses with cancel support
- Markdown and table rendering for generated responses
- Recruiter Test Kits with sample PDFs and suggested prompts
- Guided Demo Mode for structured walkthroughs
- FHIR Explorer for Patient, Observation, and Condition queries
- Vector retrieval pipeline with Supabase and Google embeddings

## Project Structure

- src/app/page.tsx: Lean orchestrator page
- src/features/clinical/hooks/useClinicalWorkbench.ts: Main state and workflow logic
- src/features/clinical/components/: Reusable feature panels
- src/app/api/retrieval/index/route.ts: Context chunking and vector indexing
- src/app/api/retrieval/query/route.ts: Similarity retrieval for evidence chunks
- src/app/api/analyze/route.ts: Streaming analysis route
- supabase/schema.sql: pgvector table and retrieval SQL function

## Local Setup

1. Install dependencies

	npm install

2. Configure environment variables in .env.local

	GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_studio_key
	SUPABASE_URL=your_supabase_project_url
	SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

3. Apply Supabase schema

	- Open Supabase SQL Editor
	- Run supabase/schema.sql

4. Start app

	npm run dev

## Vector Retrieval Flow

1. Load context in Clinical Workbench
2. Click Index Current Context
3. Ask a question with Enable vector retrieval on
4. Review citations in Evidence and Citations panel

## Recruiter Demo Flow

1. Open Recruiter Test Kits
2. Click Start Guided Demo on any kit
3. Follow the step card in Workbench
4. Show indexed retrieval and evidence panel

## Notes

- Retrieval uses rpc match_document_chunks when available.
- If rpc is unavailable, the query route falls back to cosine scoring in application code using stored embedding_json values.
