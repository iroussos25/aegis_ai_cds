import { useCallback, useState } from "react";

import {
  AnalysisTrace,
  ClinicalReviewMessage,
  EvidenceItem,
  ExternalLiteratureEvidence,
} from "@/features/clinical/types";
import { normalizeClinicalMarkdown } from "@/features/clinical/utils/clinicalText";
import { getClientApiHeaders, readApiErrorMessage } from "@/lib/client/api";

type FetchEvidenceFn = (
  prompt: string,
  options?: { updateWorkbenchEvidence?: boolean }
) => Promise<{ evidence: EvidenceItem[]; indexedDocId: string | null }>;

type UseClinicalReviewFlowParams = {
  context: string;
  fetchEvidence: FetchEvidenceFn;
  onAbortControllerChange?: (controller: AbortController | null) => void;
};

export function useClinicalReviewFlow({
  context,
  fetchEvidence,
  onAbortControllerChange,
}: UseClinicalReviewFlowParams) {
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

  const submitClinicalReview = useCallback(
    async (promptOverride?: string) => {
      const promptSnapshot = (promptOverride ?? clinicalReviewInput).trim();
      if (!promptSnapshot || !context.trim() || clinicalReviewLoading) return;

      const controller = new AbortController();
      onAbortControllerChange?.(controller);

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
              headers: getClientApiHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({ prompt: promptSnapshot, context }),
              signal: controller.signal,
            });

            if (!literatureResponse.ok) {
              throw new Error(
                await readApiErrorMessage(
                  literatureResponse,
                  `Literature search failed (${literatureResponse.status})`
                )
              );
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
              `[literature ${index + 1} | ${item.sourceLabel} | ${item.journal ?? "Unknown journal"} | ${
                item.publishedAt ?? "Unknown date"
              }]\nTitle: ${item.title}\nAbstract: ${item.abstractSnippet}`
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
          headers: getClientApiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            noteContext,
            externalEvidence: literatureEvidence,
            messages: [...priorMessages, { role: "user", content: promptSnapshot }],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, `Clinical review failed (${res.status})`));
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
          const normalizedText = normalizeClinicalMarkdown(streamedText);
          setClinicalReviewMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: normalizedText }
                : message
            )
          );
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
          streamedText += finalChunk;
          const normalizedText = normalizeClinicalMarkdown(streamedText);
          setClinicalReviewMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: normalizedText }
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
        onAbortControllerChange?.(null);
        setClinicalReviewLoading(false);
      }
    },
    [
      clinicalReviewInput,
      clinicalReviewLoading,
      clinicalReviewMessages,
      clinicalReviewUseLiterature,
      context,
      fetchEvidence,
      onAbortControllerChange,
    ]
  );

  const cancelClinicalReview = useCallback(() => {
    onAbortControllerChange?.(null);
    setClinicalReviewLoading(false);
  }, [onAbortControllerChange]);

  return {
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
    clearClinicalReview,
    submitClinicalReview,
    cancelClinicalReview,
  };
}
