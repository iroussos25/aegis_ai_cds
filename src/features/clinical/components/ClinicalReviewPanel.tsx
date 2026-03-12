import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Card } from "@/components/ui/Card";
import { AnalysisTrace, ClinicalReviewMessage, EvidenceItem } from "@/features/clinical/types";

type ClinicalReviewPanelProps = {
  context: string;
  fileName: string | null;
  clinicalReviewInput: string;
  setClinicalReviewInput: (value: string) => void;
  clinicalReviewMessages: ClinicalReviewMessage[];
  clinicalReviewLoading: boolean;
  clinicalReviewError: string | null;
  clinicalReviewEvidence: EvidenceItem[];
  clinicalReviewTrace: AnalysisTrace | null;
  retrievalEnabled: boolean;
  onSubmitClinicalReview: (promptOverride?: string) => Promise<void>;
  onCancelStreaming: () => void;
  onClearClinicalReview: () => void;
};

export function ClinicalReviewPanel({
  context,
  fileName,
  clinicalReviewInput,
  setClinicalReviewInput,
  clinicalReviewMessages,
  clinicalReviewLoading,
  clinicalReviewError,
  clinicalReviewEvidence,
  clinicalReviewTrace,
  retrievalEnabled,
  onSubmitClinicalReview,
  onCancelStreaming,
  onClearClinicalReview,
}: ClinicalReviewPanelProps) {
  const latestAssistantMessageId = [...clinicalReviewMessages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  const suggestedPrompts = useMemo(() => {
    const lowered = context.toLowerCase();
    const suggestions = [
      "What do the trends indicate?",
      "Potential diagnosis to consider",
      "Next clinical steps to consider",
      "What data is missing?",
    ];

    if (/(sepsis|lactate|hypotension|map|vasopressor|wbc|fever|cultures?)/.test(lowered)) {
      suggestions.push("Do these findings look consistent with an evolving sepsis picture?");
    }

    if (/(creatinine|oliguria|urine output|crrt|bun|dialysis|aki)/.test(lowered)) {
      suggestions.push("What do the renal trends suggest, and what unresolved kidney risks remain?");
    }

    if (/(peep|fio2|ards|ventilator|intubat|oxygen|pao2|trach)/.test(lowered)) {
      suggestions.push("Do the respiratory trends suggest worsening failure, recovery, or both?");
    }

    if (/(ecmo|cardiogenic|shock|dobutamine|norepinephrine|vasopressin|pressors?)/.test(lowered)) {
      suggestions.push("What does the hemodynamic course suggest about shock severity and recovery?");
    }

    return [...new Set(suggestions)].slice(0, 6);
  }, [context]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmitClinicalReview();
  }

  if (!context.trim()) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Clinical Review
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Load a clinical note in the Workbench first, then use this panel to ask higher-level review
          questions about possible concerns, next considerations, and missing data.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Clinical Review
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Use note-grounded AI review to synthesize patterns, identify possible clinical concerns,
                and surface missing information without changing the original summary workflow.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              For clinical decision support research only. Not for diagnostic use. All outputs must
              be verified by a licensed healthcare professional.
            </div>
          </div>

          <div className="space-y-2 lg:w-80">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              <p className="font-medium text-zinc-800 dark:text-zinc-100">Loaded Note</p>
              <p className="mt-1">{fileName ?? "Manual note text"}</p>
              <p className="mt-2">
                Note retrieval: {retrievalEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <span>Guideline grounding</span>
              <span className="rounded-full bg-zinc-200 px-2 py-1 dark:bg-zinc-800">Coming soon</span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void onSubmitClinicalReview(prompt)}
              className="rounded-full border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex h-[70vh] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review Conversation</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ask follow-up questions without losing the running thread.
            </p>
          </div>
          <button
            type="button"
            onClick={onClearClinicalReview}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence initial={false}>
            {clinicalReviewMessages.length === 0 ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-2xl rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
              >
                Start with a prompt chip above or ask your own question below. This panel is meant
                for synthesis, uncertainty review, and higher-level pattern interpretation grounded in
                the loaded note.
              </motion.div>
            ) : (
              <div className="space-y-4">
                {clinicalReviewMessages.map((message) => {
                  const isUser = message.role === "user";
                  const isLatestAssistant = message.id === latestAssistantMessageId;

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                          isUser
                            ? "bg-indigo-600 text-white"
                            : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Context-verified against loaded note
                              </span>
                            </div>
                            <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content || (clinicalReviewLoading && isLatestAssistant ? "Thinking..." : "")}
                              </ReactMarkdown>
                            </div>

                            {isLatestAssistant && clinicalReviewTrace && (
                              <details className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
                                <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                  View Logic
                                </summary>
                                <div className="mt-3 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full bg-zinc-200 px-2 py-1 dark:bg-zinc-800">
                                      {clinicalReviewTrace.usedRetrieval ? "RAG note evidence used" : "Full note context used"}
                                    </span>
                                    {clinicalReviewTrace.indexedDocId && (
                                      <span className="rounded-full bg-zinc-200 px-2 py-1 dark:bg-zinc-800">
                                        Doc ID: {clinicalReviewTrace.indexedDocId.slice(0, 8)}...
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">Prompt sent</p>
                                    <pre className="overflow-x-auto rounded-lg bg-white p-3 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                                      {clinicalReviewTrace.prompt}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">Exact context sent to Gemini</p>
                                    <pre className="max-h-72 overflow-auto rounded-lg bg-white p-3 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                                      {clinicalReviewTrace.contextSent}
                                    </pre>
                                  </div>
                                </div>
                              </details>
                            )}

                            {isLatestAssistant && clinicalReviewEvidence.length > 0 && (
                              <details className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                                <summary className="cursor-pointer text-xs font-medium text-cyan-700 dark:text-cyan-300">
                                  Supporting Evidence
                                </summary>
                                <div className="mt-3 space-y-3">
                                  {clinicalReviewEvidence.map((item) => (
                                    <div
                                      key={item.id}
                                      className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                                    >
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Chunk {item.chunkIndex} | score {item.similarity.toFixed(3)} | source {item.sourceLabel}
                                      </p>
                                      <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                                        {item.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={clinicalReviewInput}
              onChange={(e) => setClinicalReviewInput(e.target.value)}
              placeholder="Ask a higher-level follow-up, for example: What do these trends indicate, and what risks remain unresolved?"
              className="h-24 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder-zinc-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Note-only clinical review for v1. Guideline grounding will layer on top later.
              </p>
              <div className="flex items-center gap-2">
                {clinicalReviewLoading && (
                  <button
                    type="button"
                    onClick={onCancelStreaming}
                    className="rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={clinicalReviewLoading || !clinicalReviewInput.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-40"
                >
                  {clinicalReviewLoading ? "Reviewing..." : "Run Clinical Review"}
                </button>
              </div>
            </div>

            {clinicalReviewError && <p className="text-xs text-red-500">Error: {clinicalReviewError}</p>}
          </form>
        </div>
      </Card>
    </div>
  );
}
