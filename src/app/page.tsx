"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ACCEPTED = ".pdf,.txt,.csv,.md,.xml,.json,.tsv,.hl7";
const STORAGE_KEY = "clinical-analyst-state-v1";

type Panel = "workbench" | "recruiter-kit" | "fhir";

type HistoryItem = {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
};

type RecruiterKit = {
  id: string;
  title: string;
  summary: string;
  samplePdfPath: string;
  sampleContext: string;
  prompts: string[];
};

type FhirMode = "Patient" | "Observation" | "Condition";

type FhirResource = {
  resourceType?: string;
  id?: string;
  [key: string]: unknown;
};

type FhirBundleEntry = {
  resource?: FhirResource;
};

type FhirBundle = {
  total?: number;
  entry?: FhirBundleEntry[];
};

const RECRUITER_KITS: RecruiterKit[] = [
  {
    id: "discharge-summary",
    title: "Discharge Summary Review",
    summary: "Medication reconciliation + follow-up verification use case.",
    samplePdfPath: "/samples/sample-discharge-summary.pdf",
    sampleContext: `Patient: Maria Chen (DOB: 1978-02-11)
MRN: 4459012
Admit Date: 2026-01-09
Discharge Date: 2026-01-13
Primary Diagnosis: Community-acquired pneumonia
Comorbidities: Type 2 diabetes mellitus, hypertension
Imaging: CXR showed right lower lobe infiltrate
Lab highlights: WBC 13.1 K/uL on admission -> 8.2 K/uL at discharge
Creatinine remained stable at 0.9 mg/dL
Treatment: Ceftriaxone IV then oral azithromycin
Discharge meds: azithromycin 250 mg daily x 3 days
Follow-up: PCP visit in 7 days, repeat chest x-ray in 6 weeks`,
    prompts: [
      "List all discharge medications and associated durations.",
      "What objective evidence suggests improvement before discharge?",
      "Identify follow-up actions and their timelines.",
    ],
  },
  {
    id: "lab-trend",
    title: "Lab Trend Integrity Check",
    summary: "Flag abnormal values and compare with plan-of-care alignment.",
    samplePdfPath: "/samples/sample-lab-trend-report.pdf",
    sampleContext: `Patient: Derek Wallace (DOB: 1965-09-27)
Encounter Date: 2026-02-20
Reason: fatigue and mild dyspnea
CBC: Hgb 9.4 g/dL (low), Hct 29.1% (low), MCV 72 fL (low)
Iron studies: ferritin 8 ng/mL (low), transferrin saturation 9% (low)
CMP: Na 138, K 4.2, BUN 18, Creatinine 1.0
A1c: 7.8%
TSH: 2.1 mIU/L
Assessment note: Findings consistent with iron deficiency anemia
Plan: start ferrous sulfate 325 mg PO every other day; repeat CBC in 4 weeks`,
    prompts: [
      "Summarize all abnormal labs and their directionality.",
      "Does the documented assessment match the provided labs?",
      "What monitoring steps are explicitly documented in the plan?",
    ],
  },
];

// ── Highlight helper ──────────────────────────────────────────────────────────
function highlightMatches(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-indigo-200/60 px-0.5 dark:bg-indigo-500/30">
        {p}
      </mark>
    ) : (
      p
    )
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("workbench");
  const [context, setContext] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [apiError, setApiError] = useState<string | null>(null);
  const [completion, setCompletion] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const [fhirServer, setFhirServer] = useState("https://hapi.fhir.org/baseR4");
  const [fhirMode, setFhirMode] = useState<FhirMode>("Patient");
  const [fhirQuery, setFhirQuery] = useState("");
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirError, setFhirError] = useState<string | null>(null);
  const [fhirResults, setFhirResults] = useState<FhirResource[]>([]);
  const [fhirCount, setFhirCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        context?: string;
        fileName?: string | null;
        input?: string;
        completion?: string;
        history?: HistoryItem[];
      };

      if (typeof saved.context === "string") setContext(saved.context);
      if (typeof saved.fileName === "string" || saved.fileName === null) setFileName(saved.fileName ?? null);
      if (typeof saved.input === "string") setInput(saved.input);
      if (typeof saved.completion === "string") setCompletion(saved.completion);
      if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 12));
    } catch {
      // Ignore malformed local storage values.
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      context,
      fileName,
      input,
      completion,
      history: history.slice(0, 12),
    });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [context, fileName, input, completion, history]);

  const addHistoryItem = useCallback((prompt: string, response: string) => {
    const trimmedPrompt = prompt.trim();
    const trimmedResponse = response.trim();
    if (!trimmedPrompt || !trimmedResponse) return;

    setHistory((prev) => [
      {
        id: crypto.randomUUID(),
        prompt: trimmedPrompt,
        response: trimmedResponse,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 12));
  }, []);

  function cancelStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !context.trim() || isLoading) return;

    const promptSnapshot = input;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setCompletion("");
    setApiError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, context }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        setApiError(text || `Request failed (${res.status})`);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setApiError("No response stream");
        setIsLoading(false);
        return;
      }

      let streamedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamedText += chunk;
        setCompletion((prev) => prev + chunk);
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        streamedText += finalChunk;
        setCompletion((prev) => prev + finalChunk);
      }

      addHistoryItem(promptSnapshot, streamedText);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setApiError("Analysis canceled");
      } else {
        setApiError(err instanceof Error ? err.message : "Request failed");
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }

  async function handleFhirSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!fhirQuery.trim() || !fhirServer.trim()) return;

    setFhirLoading(true);
    setFhirError(null);
    setFhirResults([]);
    setFhirCount(0);

    try {
      const normalizedBase = fhirServer.replace(/\/+$/, "");
      const q = encodeURIComponent(fhirQuery.trim());
      const endpointMap: Record<FhirMode, string> = {
        Patient: `${normalizedBase}/Patient?name=${q}&_count=10`,
        Observation: `${normalizedBase}/Observation?code:text=${q}&_count=10`,
        Condition: `${normalizedBase}/Condition?code:text=${q}&_count=10`,
      };

      const res = await fetch(endpointMap[fhirMode], {
        headers: { Accept: "application/fhir+json, application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `FHIR request failed (${res.status})`);
      }

      const bundle = (await res.json()) as FhirBundle;
      const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
      const resources = entries
        .map((entry) => entry.resource)
        .filter((resource): resource is FhirResource => Boolean(resource));
      setFhirResults(resources);
      setFhirCount(typeof bundle.total === "number" ? bundle.total : resources.length);
    } catch (err) {
      setFhirError(err instanceof Error ? err.message : "FHIR search failed");
    } finally {
      setFhirLoading(false);
    }
  }

  function loadRecruiterKit(kit: RecruiterKit, prompt?: string) {
    setContext(kit.sampleContext);
    setFileName(`${kit.title} (sample)`);
    if (prompt) setInput(prompt);
    setSearch("");
    setActivePanel("workbench");
  }

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadError(null);
      setUploading(true);

      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          setUploadError(data.error ?? "Upload failed");
        } else {
          setContext(data.text);
          setFileName(file.name);
        }
      } catch {
        setUploadError("Network error — could not upload file");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    []
  );

  // ── Filtered context for search highlighting ─────────────────────────────
  const matchCount = useMemo(() => {
    if (!search.trim() || !context) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (context.match(new RegExp(escaped, "gi")) ?? []).length;
  }, [search, context]);

  return (
    <div className="relative min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 px-4 py-10 font-(family-name:--font-geist-sans) dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />
        <div className="absolute -bottom-32 -right-32 h-100 w-100 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-900/20" />
      </div>

      <main className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-3 lg:sticky lg:top-6">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Workspace
          </div>
          <div className="space-y-1">
            {[
              { key: "workbench", label: "Clinical Workbench" },
              { key: "recruiter-kit", label: "Recruiter Test Kits" },
              { key: "fhir", label: "FHIR Explorer (Beta)" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePanel(item.key as Panel)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activePanel === item.key
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            Tip: Load a recruiter kit, then jump back into Clinical Workbench to run the same analysis flow you demo live.
          </div>
        </Card>

        <div className="space-y-8">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="m9 15 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Clinical Document Analyst
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                AI-powered clinical data integrity review
              </p>
            </div>
          </div>
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
          {activePanel === "workbench" && (
            <motion.div
              key="workbench"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
        {/* ── Upload section ────────────────────────────────────────────────── */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            1. Load Document
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Drop zone / button */}
            <label
              className={`group relative flex h-28 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                uploading
                  ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30"
                  : "border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {uploading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent"
                />
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-1 h-7 w-7 text-zinc-400 transition-colors group-hover:text-indigo-500 dark:text-zinc-500"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click or drag to upload
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                    PDF, TXT, CSV, MD, XML, JSON, TSV, HL7
                  </span>
                </>
              )}
            </label>

            {/* Or paste manually */}
            <span className="hidden text-xs font-medium text-zinc-400 sm:block">
              OR
            </span>

            <div className="flex-1">
              <textarea
                className="h-28 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                placeholder="…or paste document text here"
                value={context}
                onChange={(e) => {
                  setContext(e.target.value);
                  setFileName(null);
                }}
              />
            </div>
          </div>

          <AnimatePresence>
            {fileName && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                Loaded: {fileName}
              </motion.p>
            )}
            {uploadError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-xs text-red-500"
              >
                {uploadError}
              </motion.p>
            )}
          </AnimatePresence>
        </Card>

        {/* ── Search within document ────────────────────────────────────────── */}
        <AnimatePresence>
          {context && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  2. Search Document
                </h2>

                <div className="relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search within document…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                  />
                  {search.trim() && (
                    <span className="absolute right-3 top-2.5 text-xs text-zinc-400">
                      {matchCount} match{matchCount !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>

                {/* Preview with highlights */}
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  {highlightMatches(
                    context.length > 3000
                      ? context.slice(0, 3000) + "…"
                      : context,
                    search
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ask question ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {context && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <Card>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  3. Ask a Question
                </h2>

                <form
                  onSubmit={handleSubmit}
                  className="flex gap-3"
                >
                  <input
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                    placeholder="e.g. What were the patient's lab results?"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim() || !context.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:shadow-lg disabled:opacity-40 disabled:shadow-none"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "linear",
                        }}
                        className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                      />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                      </svg>
                    )}
                    {isLoading ? "Analyzing…" : "Analyze"}
                  </button>
                  {isLoading && (
                    <button
                      type="button"
                      onClick={cancelStreaming}
                      className="rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  )}
                </form>

                <AnimatePresence>
                  {apiError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 text-xs text-red-500"
                    >
                      Error: {apiError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Response ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {completion && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-indigo-100 dark:border-indigo-900/40">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.784l-1.192.24a1 1 0 000 1.96l1.192.24a1 1 0 01.784.785l.24 1.192a1 1 0 001.96 0l.24-1.192a1 1 0 01.784-.785l1.192-.24a1 1 0 000-1.96l-1.192-.24a1 1 0 01-.784-.784l-.24-1.192zM5.98 7.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.784l-1.192.24a1 1 0 000 1.96l1.192.24a1 1 0 01.784.785l.24 1.192a1 1 0 001.96 0l.24-1.192a1 1 0 01.784-.785l1.192-.24a1 1 0 000-1.96l-1.192-.24a1 1 0 01-.784-.784l-.24-1.192z" />
                  </svg>
                  Analysis
                </h2>
                <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {completion}
                  </ReactMarkdown>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Recent Analyses
                </h2>
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Prompt</p>
                      <p className="text-sm text-zinc-800 dark:text-zinc-200">{item.prompt}</p>
                      <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Response excerpt</p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        {item.response.length > 240 ? `${item.response.slice(0, 240)}...` : item.response}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
            </motion.div>
          )}

          {activePanel === "recruiter-kit" && (
            <motion.div
              key="recruiter-kit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <Card>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Recruiter Test Kits
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Each kit includes a synthetic sample PDF, a preloaded context, and ready-to-run prompts so reviewers can validate functionality quickly.
                </p>
              </Card>

              {RECRUITER_KITS.map((kit) => (
                <Card key={kit.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{kit.title}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{kit.summary}</p>
                    </div>
                    <a
                      href={kit.samplePdfPath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Open Sample PDF
                    </a>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadRecruiterKit(kit)}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                    >
                      Load This Kit in Workbench
                    </button>
                    {kit.prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => loadRecruiterKit(kit, prompt)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Use Prompt: {prompt}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {activePanel === "fhir" && (
            <motion.div
              key="fhir"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <Card>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  FHIR Sandbox Explorer
                </h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
                  Query a FHIR server directly for Patients, Observations, and Conditions. Default points to public HAPI FHIR R4.
                </p>

                <form onSubmit={handleFhirSearch} className="space-y-3">
                  <input
                    value={fhirServer}
                    onChange={(e) => setFhirServer(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                    placeholder="FHIR base URL"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={fhirMode}
                      onChange={(e) => setFhirMode(e.target.value as FhirMode)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                    >
                      <option value="Patient">Patient</option>
                      <option value="Observation">Observation</option>
                      <option value="Condition">Condition</option>
                    </select>

                    <input
                      value={fhirQuery}
                      onChange={(e) => setFhirQuery(e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                      placeholder="Search term (name, code text, etc.)"
                    />

                    <button
                      type="submit"
                      disabled={fhirLoading || !fhirQuery.trim()}
                      className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {fhirLoading ? "Searching..." : "Search"}
                    </button>
                  </div>
                </form>

                {fhirError && <p className="mt-3 text-xs text-red-500">Error: {fhirError}</p>}
              </Card>

              <Card>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Results ({fhirCount})
                </h3>
                <div className="mt-3 max-h-130 overflow-y-auto space-y-2">
                  {fhirResults.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No resources loaded yet.</p>
                  )}
                  {fhirResults.map((resource) => (
                    <details key={`${resource.resourceType}-${resource.id}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <summary className="cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
                        {resource.resourceType} {resource.id ? `• ${resource.id}` : ""}
                      </summary>
                      <pre className="mt-2 overflow-x-auto text-xs text-zinc-700 dark:text-zinc-300">
                        {JSON.stringify(resource, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
