import { useCallback, useMemo, useRef, useState } from "react";
import {
  FhirResource,
  RecruiterKit,
} from "@/features/clinical/types";
import { useClinicalReviewFlow } from "@/features/clinical/hooks/useClinicalReviewFlow";
import { useContextUpload } from "@/features/clinical/hooks/useContextUpload";
import { useFhirExplorer } from "@/features/clinical/hooks/useFhirExplorer";
import { useRecruiterDemoState } from "@/features/clinical/hooks/useRecruiterDemoState";
import { useWorkbenchAnalysis } from "@/features/clinical/hooks/useWorkbenchAnalysis";
import { createContextSignature } from "@/features/clinical/utils/clinicalText";
import { clinicalBlockForFhirResource } from "@/features/clinical/utils/fhirWorkbenchFormat";

export function useClinicalWorkbench() {
  const [context, setContext] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const handleAbortControllerChange = useCallback((controller: AbortController | null) => {
    abortRef.current = controller;
  }, []);

  const currentContextSignature = useMemo(
    () => createContextSignature(context, fileName),
    [context, fileName]
  );

  const analysis = useWorkbenchAnalysis({
    context,
    fileName,
    currentContextSignature,
    onAbortControllerChange: handleAbortControllerChange,
  });

  const clinicalReview = useClinicalReviewFlow({
    context,
    fetchEvidence: analysis.fetchEvidence,
    onAbortControllerChange: handleAbortControllerChange,
  });

  const demoState = useRecruiterDemoState();

  const upload = useContextUpload({
    onUploaded: ({ text, fileName: uploadedFileName }) => {
      setContext(text);
      setFileName(uploadedFileName);
      analysis.setAutoIndexEnabled(true);
      analysis.setIndexedDocId(null);
      analysis.setIndexedContextSignature(null);
      analysis.setEvidence([]);
      analysis.setAnalysisTrace(null);
      clinicalReview.clearClinicalReview();
    },
  });

  const {
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
    fhirLastRequestUrl,
    searchFhir,
    clearFhirResults,
    resetFhirExplorer,
  } = useFhirExplorer();

  const matchCount = useMemo(() => {
    if (!search.trim() || !context) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (context.match(new RegExp(escaped, "gi")) ?? []).length;
  }, [search, context]);

  const clearAllState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setContext("");
    setFileName(null);
    upload.resetUploadState();
    setSearch("");

    analysis.setApiError(null);
    analysis.setCompletion("");
    analysis.setInput("");
    analysis.setIsLoading(false);
    analysis.setHistory([]);
    analysis.setEvidence([]);
    analysis.setAnalysisTrace(null);
    analysis.setRetrievalEnabled(true);
    analysis.setAutoIndexEnabled(true);
    analysis.setIndexing(false);
    analysis.setIndexError(null);
    analysis.setIndexedDocId(null);
    analysis.setIndexedContextSignature(null);

    clinicalReview.clearClinicalReview();
    clinicalReview.setClinicalReviewUseLiterature(true);

    demoState.clearAllRubricScores();
    demoState.resetDemoState();

    resetFhirExplorer();
  }, [analysis, clinicalReview, demoState, resetFhirExplorer, upload]);

  function cancelStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    analysis.cancelAnalysis();
    clinicalReview.cancelClinicalReview();
  }

  function addFhirResourceToWorkbench(resource: FhirResource) {
    const block = clinicalBlockForFhirResource(resource);

    setContext((prev) => {
      const existing = prev.trim();
      return existing ? `${existing}\n\n${block}` : block;
    });

    analysis.setInput((prev) =>
      prev.trim()
        ? prev
        : "Summarize the key clinical findings and any immediate concerns from this imported FHIR data."
    );

    setSearch("");
    analysis.setAutoIndexEnabled(true);
    analysis.setIndexedDocId(null);
    analysis.setIndexedContextSignature(null);
    analysis.setEvidence([]);
    analysis.setAnalysisTrace(null);
    clinicalReview.clearClinicalReview();
  }

  function loadRecruiterKit(kit: RecruiterKit, prompt?: string) {
    setContext(kit.sampleContext);
    setFileName(`${kit.title} (sample)`);
    analysis.setInput(prompt ?? "");
    setSearch("");
    analysis.setEvidence([]);
    analysis.setCompletion("");
    analysis.setHistory([]);
    analysis.setAutoIndexEnabled(true);
    analysis.setIndexedDocId(null);
    analysis.setIndexedContextSignature(null);
    analysis.setAnalysisTrace(null);
    clinicalReview.clearClinicalReview();
  }

  function startDemoMode(kit?: RecruiterKit) {
    demoState.startDemoMode(
      kit,
      (selectedKit) => loadRecruiterKit(selectedKit, selectedKit.prompts[0])
    );
  }

  function advanceDemoStep() {
    demoState.advanceDemoStep();
  }

  function stopDemoMode() {
    demoState.stopDemoMode();
  }

  return {
    context,
    setContext,
    fileName,
    setFileName,
    uploading: upload.uploading,
    uploadError: upload.uploadError,
    search,
    setSearch,
    matchCount,

    apiError: analysis.apiError,
    completion: analysis.completion,
    input: analysis.input,
    setInput: analysis.setInput,
    isLoading: analysis.isLoading,
    history: analysis.history,
    evidence: analysis.evidence,
    analysisTrace: analysis.analysisTrace,
    clinicalReviewInput: clinicalReview.clinicalReviewInput,
    setClinicalReviewInput: clinicalReview.setClinicalReviewInput,
    clinicalReviewMessages: clinicalReview.clinicalReviewMessages,
    clinicalReviewLoading: clinicalReview.clinicalReviewLoading,
    clinicalReviewError: clinicalReview.clinicalReviewError,
    clinicalReviewEvidence: clinicalReview.clinicalReviewEvidence,
    clinicalReviewTrace: clinicalReview.clinicalReviewTrace,
    clinicalReviewUseLiterature: clinicalReview.clinicalReviewUseLiterature,
    setClinicalReviewUseLiterature: clinicalReview.setClinicalReviewUseLiterature,
    clinicalReviewLiteratureQuery: clinicalReview.clinicalReviewLiteratureQuery,
    clinicalReviewLiteratureEvidence: clinicalReview.clinicalReviewLiteratureEvidence,
    clinicalReviewLiteratureError: clinicalReview.clinicalReviewLiteratureError,
    rubricScores: demoState.rubricScores,

    retrievalEnabled: analysis.retrievalEnabled,
    setRetrievalEnabled: analysis.setRetrievalEnabled,
    autoIndexEnabled: analysis.autoIndexEnabled,
    setAutoIndexEnabled: analysis.setAutoIndexEnabled,
    indexing: analysis.indexing,
    indexError: analysis.indexError,
    indexedDocId: analysis.indexedDocId,
    isIndexCurrent: analysis.isIndexCurrent,

    demoMode: demoState.demoMode,
    demoStep: demoState.demoStep,

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
    fhirLastRequestUrl,

    uploadFile: upload.uploadFile,
    submitQuestion: analysis.submitQuestion,
    cancelStreaming,
    searchFhir,
    clearFhirResults,
    addFhirResourceToWorkbench,
    loadRecruiterKit,
    clearHistory: analysis.clearHistory,
    clearClinicalReview: clinicalReview.clearClinicalReview,
    submitClinicalReview: clinicalReview.submitClinicalReview,
    setRubricScore: demoState.setRubricScore,
    clearKitRubricScores: demoState.clearKitRubricScores,
    clearAllState,
    indexCurrentContext: analysis.indexCurrentContext,
    startDemoMode,
    advanceDemoStep,
    stopDemoMode,
  };
}
