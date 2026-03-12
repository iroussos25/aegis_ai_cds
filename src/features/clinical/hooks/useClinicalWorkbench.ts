import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STORAGE_KEY } from "@/features/clinical/constants";
import { FhirBundle, FhirMode, FhirResource, HistoryItem, RecruiterKit, EvidenceItem } from "@/features/clinical/types";

type PersistedState = {
  context?: string;
  fileName?: string | null;
  input?: string;
  completion?: string;
  history?: HistoryItem[];
  indexedDocId?: string | null;
};

export function useClinicalWorkbench() {
  const [context, setContext] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [apiError, setApiError] = useState<string | null>(null);
  const [completion, setCompletion] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const [retrievalEnabled, setRetrievalEnabled] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexedDocId, setIndexedDocId] = useState<string | null>(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(1);

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

      const saved = JSON.parse(raw) as PersistedState;
      if (typeof saved.context === "string") setContext(saved.context);
      if (typeof saved.fileName === "string" || saved.fileName === null) {
        setFileName(saved.fileName ?? null);
      }
      if (typeof saved.input === "string") setInput(saved.input);
      if (typeof saved.completion === "string") setCompletion(saved.completion);
      if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 12));
      if (typeof saved.indexedDocId === "string") setIndexedDocId(saved.indexedDocId);
    } catch {
      // Ignore malformed local storage.
    }
  }, []);

  useEffect(() => {
    const payload: PersistedState = {
      context,
      fileName,
      input,
      completion,
      history: history.slice(0, 12),
      indexedDocId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [context, fileName, input, completion, history, indexedDocId]);

  const matchCount = useMemo(() => {
    if (!search.trim() || !context) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (context.match(new RegExp(escaped, "gi")) ?? []).length;
  }, [search, context]);

  const addHistoryItem = useCallback((prompt: string, response: string) => {
    const trimmedPrompt = prompt.trim();
    const trimmedResponse = response.trim();
    if (!trimmedPrompt || !trimmedResponse) return;

    setHistory((prev) =>
      [
        {
          id: crypto.randomUUID(),
          prompt: trimmedPrompt,
          response: trimmedResponse,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 12)
    );
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  function cancelStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  async function indexCurrentContext() {
    if (!context.trim()) {
      setIndexError("Load or paste context before indexing.");
      return;
    }

    setIndexing(true);
    setIndexError(null);

    try {
      const res = await fetch("/api/retrieval/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          fileName,
          sourceType: fileName ? "upload" : "manual",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Vector indexing failed");
      }

      setIndexedDocId(data.docId ?? null);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Vector indexing failed");
    } finally {
      setIndexing(false);
    }
  }

  async function fetchEvidence(prompt: string) {
    if (!retrievalEnabled || !indexedDocId) {
      setEvidence([]);
      return [] as EvidenceItem[];
    }

    const res = await fetch("/api/retrieval/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: prompt,
        docId: indexedDocId,
        topK: 5,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Evidence retrieval failed");
    }

    const nextEvidence = Array.isArray(data.evidence)
      ? (data.evidence as EvidenceItem[])
      : [];

    setEvidence(nextEvidence);
    return nextEvidence;
  }

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !context.trim() || isLoading) return;

    const promptSnapshot = input;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setCompletion("");
    setApiError(null);

    try {
      const retrieved = await fetchEvidence(promptSnapshot);
      const retrievalContext =
        retrieved.length > 0
          ? retrieved
              .map(
                (item) =>
                  `[chunk ${item.chunkIndex} | score ${item.similarity.toFixed(3)} | source ${item.sourceLabel}]\n${item.content}`
              )
              .join("\n\n")
          : context;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptSnapshot, context: retrievalContext }),
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setApiError("Analysis canceled");
      } else {
        setApiError(error instanceof Error ? error.message : "Request failed");
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }

  async function uploadFile(file: File) {
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
        setIndexedDocId(null);
        setEvidence([]);
      }
    } catch {
      setUploadError("Network error - could not upload file");
    } finally {
      setUploading(false);
    }
  }

  async function searchFhir(e: React.FormEvent) {
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
    } catch (error) {
      setFhirError(error instanceof Error ? error.message : "FHIR search failed");
    } finally {
      setFhirLoading(false);
    }
  }

  function loadRecruiterKit(kit: RecruiterKit, prompt?: string) {
    setContext(kit.sampleContext);
    setFileName(`${kit.title} (sample)`);
    setInput(prompt ?? "");
    setSearch("");
    setEvidence([]);
    setCompletion("");
    setHistory([]);
    setIndexedDocId(null);
  }

  function startDemoMode(kit?: RecruiterKit) {
    setDemoMode(true);
    setDemoStep(1);
    if (kit) loadRecruiterKit(kit, kit.prompts[0]);
  }

  function advanceDemoStep() {
    setDemoStep((prev) => Math.min(prev + 1, 4));
  }

  function stopDemoMode() {
    setDemoMode(false);
    setDemoStep(1);
  }

  return {
    context,
    setContext,
    fileName,
    setFileName,
    uploading,
    uploadError,
    search,
    setSearch,
    matchCount,

    apiError,
    completion,
    input,
    setInput,
    isLoading,
    history,
    evidence,

    retrievalEnabled,
    setRetrievalEnabled,
    indexing,
    indexError,
    indexedDocId,

    demoMode,
    demoStep,

    fhirServer,
    setFhirServer,
    fhirMode,
    setFhirMode,
    fhirQuery,
    setFhirQuery,
    fhirLoading,
    fhirError,
    fhirResults,
    fhirCount,

    uploadFile,
    submitQuestion,
    cancelStreaming,
    searchFhir,
    loadRecruiterKit,
    clearHistory,
    indexCurrentContext,
    startDemoMode,
    advanceDemoStep,
    stopDemoMode,
  };
}
