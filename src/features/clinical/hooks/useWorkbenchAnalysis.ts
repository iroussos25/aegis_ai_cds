import { FormEvent, useCallback, useState } from "react";

import { AnalysisTrace, EvidenceItem, HistoryItem } from "@/features/clinical/types";
import { getClientApiHeaders, readApiErrorMessage } from "@/lib/client/api";

type UseWorkbenchAnalysisParams = {
  context: string;
  fileName: string | null;
  currentContextSignature: string;
  onAbortControllerChange?: (controller: AbortController | null) => void;
};

export function useWorkbenchAnalysis({
  context,
  fileName,
  currentContextSignature,
  onAbortControllerChange,
}: UseWorkbenchAnalysisParams) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [completion, setCompletion] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [analysisTrace, setAnalysisTrace] = useState<AnalysisTrace | null>(null);

  const [retrievalEnabled, setRetrievalEnabled] = useState(true);
  const [autoIndexEnabled, setAutoIndexEnabled] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexedDocId, setIndexedDocId] = useState<string | null>(null);
  const [indexedContextSignature, setIndexedContextSignature] = useState<string | null>(null);

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

  const indexCurrentContext = useCallback(async () => {
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
        headers: getClientApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          context,
          fileName,
          sourceType: fileName ? "upload" : "manual",
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, "Vector indexing failed"));
      }

      const data = (await res.json()) as { docId?: string };

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
  }, [context, currentContextSignature, fileName, indexedDocId, isIndexCurrent]);

  const fetchEvidence = useCallback(
    async (prompt: string, options?: { updateWorkbenchEvidence?: boolean }) => {
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
        headers: getClientApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          query: prompt,
          docId,
          topK: 5,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, "Evidence retrieval failed"));
      }

      const data = (await res.json()) as { evidence?: EvidenceItem[] };

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
    },
    [autoIndexEnabled, indexCurrentContext, indexedDocId, isIndexCurrent, retrievalEnabled]
  );

  const submitQuestion = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !context.trim() || isLoading) return;

      const promptSnapshot = input;
      const controller = new AbortController();
      onAbortControllerChange?.(controller);

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
          headers: getClientApiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ prompt: promptSnapshot, context: retrievalContext }),
          signal: controller.signal,
        });
        const resClone = res.clone();

        if (!res.ok) {
          const message = await readApiErrorMessage(res, `Request failed (${res.status})`);
          setApiError(message);
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
        onAbortControllerChange?.(null);
        setIsLoading(false);
      }
    },
    [addHistoryItem, context, fetchEvidence, input, isLoading, onAbortControllerChange]
  );

  const cancelAnalysis = useCallback(() => {
    onAbortControllerChange?.(null);
    setIsLoading(false);
  }, [onAbortControllerChange]);

  return {
    apiError,
    completion,
    input,
    setInput,
    isLoading,
    history,
    evidence,
    analysisTrace,
    retrievalEnabled,
    setRetrievalEnabled,
    autoIndexEnabled,
    setAutoIndexEnabled,
    indexing,
    setIndexing,
    indexError,
    setIndexError,
    indexedDocId,
    setIndexedDocId,
    setIndexedContextSignature,
    isIndexCurrent,
    setEvidence,
    setAnalysisTrace,
    setCompletion,
    setApiError,
    setIsLoading,
    setHistory,
    clearHistory,
    indexCurrentContext,
    fetchEvidence,
    submitQuestion,
    cancelAnalysis,
  };
}
