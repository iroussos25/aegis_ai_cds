import { useCallback, useMemo, useRef, useState } from "react";
import {
  AnalysisTrace,
  ClinicalReviewMessage,
  EvidenceItem,
  ExternalLiteratureEvidence,
  FhirBundle,
  FhirMode,
  FhirResource,
  HistoryItem,
  RecruiterKit,
} from "@/features/clinical/types";

function createContextSignature(context: string, fileName: string | null) {
  let hash = 0;
  const source = `${fileName ?? "manual"}\n${context}`;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

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
  const [analysisTrace, setAnalysisTrace] = useState<AnalysisTrace | null>(null);
  const [clinicalReviewInput, setClinicalReviewInput] = useState("");
  const [clinicalReviewMessages, setClinicalReviewMessages] = useState<ClinicalReviewMessage[]>([]);
  const [clinicalReviewLoading, setClinicalReviewLoading] = useState(false);
  const [clinicalReviewError, setClinicalReviewError] = useState<string | null>(null);
  const [clinicalReviewEvidence, setClinicalReviewEvidence] = useState<EvidenceItem[]>([]);
  const [clinicalReviewTrace, setClinicalReviewTrace] = useState<AnalysisTrace | null>(null);
  const [clinicalReviewUseLiterature, setClinicalReviewUseLiterature] = useState(true);
  const [clinicalReviewLiteratureQuery, setClinicalReviewLiteratureQuery] = useState<string | null>(null);
  const [clinicalReviewLiteratureEvidence, setClinicalReviewLiteratureEvidence] = useState<
    ExternalLiteratureEvidence[]
  >([]);
  const [clinicalReviewLiteratureError, setClinicalReviewLiteratureError] = useState<string | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, Record<number, number>>>({});

  const [retrievalEnabled, setRetrievalEnabled] = useState(true);
  const [autoIndexEnabled, setAutoIndexEnabled] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexedDocId, setIndexedDocId] = useState<string | null>(null);
  const [indexedContextSignature, setIndexedContextSignature] = useState<string | null>(null);

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

  const matchCount = useMemo(() => {
    if (!search.trim() || !context) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (context.match(new RegExp(escaped, "gi")) ?? []).length;
  }, [search, context]);

  const currentContextSignature = useMemo(
    () => createContextSignature(context, fileName),
    [context, fileName]
  );

  const isIndexCurrent = Boolean(
    indexedDocId && indexedContextSignature === currentContextSignature
  );

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

  const clearClinicalReview = useCallback(() => {
    setClinicalReviewInput("");
    setClinicalReviewMessages([]);
    setClinicalReviewLoading(false);
    setClinicalReviewError(null);
    setClinicalReviewEvidence([]);
    setClinicalReviewTrace(null);
    setClinicalReviewLiteratureQuery(null);
    setClinicalReviewLiteratureEvidence([]);
    setClinicalReviewLiteratureError(null);
  }, []);

  const setRubricScore = useCallback((kitId: string, criterionIndex: number, score: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [kitId]: {
        ...(prev[kitId] ?? {}),
        [criterionIndex]: score,
      },
    }));
  }, []);

  const clearKitRubricScores = useCallback((kitId: string) => {
    setRubricScores((prev) => {
      const next = { ...prev };
      delete next[kitId];
      return next;
    });
  }, []);

  const clearAllState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setContext("");
    setFileName(null);
    setUploading(false);
    setUploadError(null);
    setSearch("");

    setApiError(null);
    setCompletion("");
    setInput("");
    setIsLoading(false);
    setHistory([]);
    setEvidence([]);
    setAnalysisTrace(null);
    clearClinicalReview();
    setClinicalReviewUseLiterature(true);
    setRubricScores({});

    setRetrievalEnabled(true);
    setAutoIndexEnabled(true);
    setIndexing(false);
    setIndexError(null);
    setIndexedDocId(null);
    setIndexedContextSignature(null);

    setDemoMode(false);
    setDemoStep(1);

    setFhirServer("https://hapi.fhir.org/baseR4");
    setFhirMode("Patient");
    setFhirQuery("");
    setFhirLoading(false);
    setFhirError(null);
    setFhirResults([]);
    setFhirCount(0);
  }, [clearClinicalReview]);

  function cancelStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setClinicalReviewLoading(false);
  }

  async function indexCurrentContext() {
    if (!context.trim()) {
      setIndexError("Load or paste context before indexing.");
      return null;
    }

    if (isIndexCurrent && indexedDocId) {
      setIndexError(null);
      return { docId: indexedDocId, reusedExisting: true };
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

      const nextDocId = data.docId ?? null;
      setIndexedDocId(nextDocId);
      setIndexedContextSignature(currentContextSignature);
      return { docId: nextDocId, reusedExisting: false };
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Vector indexing failed");
      return null;
    } finally {
      setIndexing(false);
    }
  }

  async function fetchEvidence(
    prompt: string,
    options?: { updateWorkbenchEvidence?: boolean }
  ) {
    if (!retrievalEnabled) {
      if (options?.updateWorkbenchEvidence !== false) {
        setEvidence([]);
      }
      return {
        evidence: [] as EvidenceItem[],
        indexedDocId: null,
      };
    }

    let docId = isIndexCurrent ? indexedDocId : null;

    if (!docId && autoIndexEnabled) {
      const indexResult = await indexCurrentContext();
      docId = indexResult?.docId ?? null;
    }

    if (!docId) {
      if (options?.updateWorkbenchEvidence !== false) {
        setEvidence([]);
      }
      return {
        evidence: [] as EvidenceItem[],
        indexedDocId: null,
      };
    }

    const res = await fetch("/api/retrieval/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: prompt,
        docId,
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

    if (options?.updateWorkbenchEvidence !== false) {
      setEvidence(nextEvidence);
    }

    return {
      evidence: nextEvidence,
      indexedDocId: docId,
    };
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
    setAnalysisTrace(null);

    try {
      const { evidence: retrieved, indexedDocId: retrievalDocId } = await fetchEvidence(promptSnapshot);
      const retrievalContext =
        retrieved.length > 0
          ? retrieved
              .map(
                (item) =>
                  `[chunk ${item.chunkIndex} | score ${item.similarity.toFixed(3)} | source ${item.sourceLabel}]\n${item.content}`
              )
              .join("\n\n")
          : context;

      setAnalysisTrace({
        prompt: promptSnapshot,
        contextSent: retrievalContext,
        usedRetrieval: retrieved.length > 0,
        indexedDocId: retrievalDocId,
      });

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptSnapshot, context: retrievalContext }),
        signal: controller.signal,
      });
      const resClone = res.clone();

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

      // Some environments complete the request but never surface incremental text chunks.
      // Fall back to the buffered response so the final analysis still renders.
      if (!streamedText.trim()) {
        const bufferedText = await resClone.text();
        if (bufferedText.trim()) {
          streamedText = bufferedText;
          setCompletion(bufferedText);
        }
      }

      if (!streamedText.trim()) {
        setApiError("Analysis completed but returned no visible content.");
        return;
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

  async function submitClinicalReview(promptOverride?: string) {
    const promptSnapshot = (promptOverride ?? clinicalReviewInput).trim();
    if (!promptSnapshot || !context.trim() || clinicalReviewLoading) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: ClinicalReviewMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: promptSnapshot,
      createdAt: new Date().toISOString(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: ClinicalReviewMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    const priorMessages = clinicalReviewMessages.map(({ role, content }) => ({ role, content }));

    setClinicalReviewLoading(true);
    setClinicalReviewError(null);
    setClinicalReviewInput("");
    setClinicalReviewEvidence([]);
    setClinicalReviewTrace(null);
    setClinicalReviewLiteratureQuery(null);
    setClinicalReviewLiteratureEvidence([]);
    setClinicalReviewLiteratureError(null);
    setClinicalReviewMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const { evidence: retrieved, indexedDocId: retrievalDocId } = await fetchEvidence(promptSnapshot, {
        updateWorkbenchEvidence: false,
      });

      let literatureResult: {
        query?: string | null;
        evidence?: ExternalLiteratureEvidence[];
      } = { query: null, evidence: [] };

      if (clinicalReviewUseLiterature) {
        try {
          const literatureResponse = await fetch("/api/clinical-review/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptSnapshot, context }),
            signal: controller.signal,
          });

          if (!literatureResponse.ok) {
            const text = await literatureResponse.text();
            throw new Error(text || `Literature search failed (${literatureResponse.status})`);
          }

          literatureResult = (await literatureResponse.json()) as {
            query?: string;
            evidence?: ExternalLiteratureEvidence[];
          };
        } catch (error) {
          setClinicalReviewLiteratureError(
            error instanceof Error ? error.message : "External literature grounding failed"
          );
        }
      }

      const noteContext =
        retrieved.length > 0
          ? retrieved
              .map(
                (item) =>
                  `[chunk ${item.chunkIndex} | score ${item.similarity.toFixed(3)} | source ${item.sourceLabel}]\n${item.content}`
              )
              .join("\n\n")
          : context;

      const literatureEvidence = Array.isArray(literatureResult.evidence)
        ? literatureResult.evidence
        : [];
      const literatureContext = literatureEvidence
        .map(
          (item, index) =>
            `[literature ${index + 1} | ${item.sourceLabel} | ${item.journal ?? "Unknown journal"} | ${item.publishedAt ?? "Unknown date"}]\nTitle: ${item.title}\nAbstract: ${item.abstractSnippet}`
        )
        .join("\n\n");

      const combinedContext = literatureContext
        ? `${noteContext}\n\n<external_literature_context>\n${literatureContext}\n</external_literature_context>`
        : noteContext;

      setClinicalReviewEvidence(retrieved);
      setClinicalReviewLiteratureQuery(
        typeof literatureResult.query === "string" ? literatureResult.query : null
      );
      setClinicalReviewLiteratureEvidence(literatureEvidence);
      setClinicalReviewTrace({
        prompt: promptSnapshot,
        contextSent: combinedContext,
        usedRetrieval: retrieved.length > 0,
        indexedDocId: retrievalDocId,
      });

      const res = await fetch("/api/clinical-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteContext,
          externalEvidence: literatureEvidence,
          messages: [...priorMessages, { role: "user", content: promptSnapshot }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Clinical review failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let streamedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamedText += chunk;
        setClinicalReviewMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: streamedText }
              : message
          )
        );
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        streamedText += finalChunk;
        setClinicalReviewMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: streamedText }
              : message
          )
        );
      }
    } catch (error) {
      setClinicalReviewMessages((prev) => prev.filter((message) => message.id !== assistantId));

      if (error instanceof DOMException && error.name === "AbortError") {
        setClinicalReviewError("Clinical review canceled");
      } else {
        setClinicalReviewError(error instanceof Error ? error.message : "Clinical review failed");
      }
    } finally {
      abortRef.current = null;
      setClinicalReviewLoading(false);
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
        setAutoIndexEnabled(true);
        setIndexedDocId(null);
        setIndexedContextSignature(null);
        setEvidence([]);
        setAnalysisTrace(null);
        clearClinicalReview();
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
    setAutoIndexEnabled(true);
    setIndexedDocId(null);
    setIndexedContextSignature(null);
    setAnalysisTrace(null);
    clearClinicalReview();
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
    analysisTrace,
    clinicalReviewInput,
    setClinicalReviewInput,
    clinicalReviewMessages,
    clinicalReviewLoading,
    clinicalReviewError,
    clinicalReviewEvidence,
    clinicalReviewTrace,
    clinicalReviewUseLiterature,
    setClinicalReviewUseLiterature,
    clinicalReviewLiteratureQuery,
    clinicalReviewLiteratureEvidence,
    clinicalReviewLiteratureError,
    rubricScores,

    retrievalEnabled,
    setRetrievalEnabled,
    autoIndexEnabled,
    setAutoIndexEnabled,
    indexing,
    indexError,
    indexedDocId,
    isIndexCurrent,

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
    clearClinicalReview,
    submitClinicalReview,
    setRubricScore,
    clearKitRubricScores,
    clearAllState,
    indexCurrentContext,
    startDemoMode,
    advanceDemoStep,
    stopDemoMode,
  };
}
