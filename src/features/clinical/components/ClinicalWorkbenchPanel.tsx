import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Card } from "@/components/ui/Card";
import { EvidencePanel } from "@/features/clinical/components/EvidencePanel";
import { ACCEPTED } from "@/features/clinical/constants";
import { EvidenceItem, HistoryItem } from "@/features/clinical/types";
import { highlightMatches } from "@/features/clinical/utils/highlightMatches";

type ClinicalWorkbenchPanelProps = {
  context: string;
  setContext: (value: string) => void;
  fileName: string | null;
  setFileName: (value: string | null) => void;
  uploading: boolean;
  uploadError: string | null;

  search: string;
  setSearch: (value: string) => void;
  matchCount: number;

  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  apiError: string | null;
  completion: string;
  history: HistoryItem[];
  evidence: EvidenceItem[];

  retrievalEnabled: boolean;
  setRetrievalEnabled: (value: boolean) => void;
  indexing: boolean;
  indexError: string | null;
  indexedDocId: string | null;

  onUploadFile: (file: File) => Promise<void>;
  onSubmitQuestion: (e: React.FormEvent) => Promise<void>;
  onCancelStreaming: () => void;
  onIndexContext: () => Promise<void>;
};

export function ClinicalWorkbenchPanel({
  context,
  setContext,
  fileName,
  setFileName,
  uploading,
  uploadError,
  search,
  setSearch,
  matchCount,
  input,
  setInput,
  isLoading,
  apiError,
  completion,
  history,
  evidence,
  retrievalEnabled,
  setRetrievalEnabled,
  indexing,
  indexError,
  indexedDocId,
  onUploadFile,
  onSubmitQuestion,
  onCancelStreaming,
  onIndexContext,
}: ClinicalWorkbenchPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await onUploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          0. Retrieval Controls
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={retrievalEnabled}
              onChange={(e) => setRetrievalEnabled(e.target.checked)}
            />
            Enable vector retrieval
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={indexing || !context.trim()}
              onClick={onIndexContext}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {indexing ? "Indexing..." : "Index Current Context"}
            </button>
            {indexedDocId && (
              <span className="rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Indexed: {indexedDocId.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>

        {indexError && <p className="mt-2 text-xs text-red-500">Error: {indexError}</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          1. Load Document
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Click or drag to upload
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                  PDF, TXT, CSV, MD, XML, JSON, TSV, HL7
                </span>
              </>
            )}
          </label>

          <span className="hidden text-xs font-medium text-zinc-400 sm:block">OR</span>

          <div className="flex-1">
            <textarea
              className="h-28 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
              placeholder="...or paste document text here"
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
              className="mt-2 text-xs text-emerald-600 dark:text-emerald-400"
            >
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
                <input
                  type="text"
                  placeholder="Search within document"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-3 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                />
                {search.trim() && (
                  <span className="absolute right-3 top-2.5 text-xs text-zinc-400">
                    {matchCount} match{matchCount !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                {highlightMatches(
                  context.length > 3000 ? `${context.slice(0, 3000)}...` : context,
                  search
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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

              <form onSubmit={onSubmitQuestion} className="flex gap-3">
                <input
                  className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
                  placeholder="What were the patient lab trends?"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || !context.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-40"
                >
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
                {isLoading && (
                  <button
                    type="button"
                    onClick={onCancelStreaming}
                    className="rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
              </form>

              {apiError && <p className="mt-3 text-xs text-red-500">Error: {apiError}</p>}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completion && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-indigo-100 dark:border-indigo-900/40">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                Analysis
              </h2>
              <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{completion}</ReactMarkdown>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <EvidencePanel evidence={evidence} />

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
                  <div
                    key={item.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Prompt</p>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{item.prompt}</p>
                    <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Response excerpt
                    </p>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">
                      {item.response.length > 240
                        ? `${item.response.slice(0, 240)}...`
                        : item.response}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
