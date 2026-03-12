"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AppSidebar } from "@/features/clinical/components/AppSidebar";
import { ClinicalWorkbenchPanel } from "@/features/clinical/components/ClinicalWorkbenchPanel";
import { DemoGuide } from "@/features/clinical/components/DemoGuide";
import { FhirExplorerPanel } from "@/features/clinical/components/FhirExplorerPanel";
import { RecruiterKitPanel } from "@/features/clinical/components/RecruiterKitPanel";
import { RECRUITER_KITS } from "@/features/clinical/constants";
import { useClinicalWorkbench } from "@/features/clinical/hooks/useClinicalWorkbench";
import { Panel } from "@/features/clinical/types";

export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("workbench");

  const vm = useClinicalWorkbench();

  function handleLoadKit(...args: Parameters<typeof vm.loadRecruiterKit>) {
    vm.loadRecruiterKit(...args);
    setActivePanel("workbench");
  }

  function handleStartDemo(kit: (typeof RECRUITER_KITS)[number]) {
    vm.startDemoMode(kit);
    setActivePanel("workbench");
  }

  function handleClearAll() {
    const confirmed = window.confirm(
      "Clear all app data? This will reset context, analyses, retrieval state, and FHIR results."
    );
    if (!confirmed) return;

    vm.clearAllState();
    setActivePanel("workbench");
  }

  return (
    <div className="relative min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 px-4 py-10 font-(family-name:--font-geist-sans) dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />
        <div className="absolute -bottom-32 -right-32 h-100 w-100 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-900/20" />
      </div>

      <main className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[240px_1fr]">
        <AppSidebar activePanel={activePanel} setActivePanel={setActivePanel} />

        <div className="space-y-8">
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between gap-3">
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
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Clear All
              </button>
            </div>
          </motion.header>

          <DemoGuide
            demoMode={vm.demoMode}
            demoStep={vm.demoStep}
            onAdvance={vm.advanceDemoStep}
            onExit={vm.stopDemoMode}
          />

          <AnimatePresence mode="wait" initial={false}>
            {activePanel === "workbench" && (
              <motion.div
                key="workbench"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ClinicalWorkbenchPanel
                  context={vm.context}
                  setContext={vm.setContext}
                  fileName={vm.fileName}
                  setFileName={vm.setFileName}
                  uploading={vm.uploading}
                  uploadError={vm.uploadError}
                  search={vm.search}
                  setSearch={vm.setSearch}
                  matchCount={vm.matchCount}
                  input={vm.input}
                  setInput={vm.setInput}
                  isLoading={vm.isLoading}
                  apiError={vm.apiError}
                  completion={vm.completion}
                  history={vm.history}
                  evidence={vm.evidence}
                  analysisTrace={vm.analysisTrace}
                  retrievalEnabled={vm.retrievalEnabled}
                  setRetrievalEnabled={vm.setRetrievalEnabled}
                  indexing={vm.indexing}
                  indexError={vm.indexError}
                  indexedDocId={vm.indexedDocId}
                  onUploadFile={vm.uploadFile}
                  onSubmitQuestion={vm.submitQuestion}
                  onCancelStreaming={vm.cancelStreaming}
                  onIndexContext={vm.indexCurrentContext}
                  onClearHistory={vm.clearHistory}
                />
              </motion.div>
            )}

            {activePanel === "recruiter-kit" && (
              <motion.div
                key="recruiter-kit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <RecruiterKitPanel
                  kits={RECRUITER_KITS}
                  onLoad={handleLoadKit}
                  onStartDemo={handleStartDemo}
                  rubricScores={vm.rubricScores}
                  onSetRubricScore={vm.setRubricScore}
                  onClearRubricScores={vm.clearKitRubricScores}
                />
              </motion.div>
            )}

            {activePanel === "fhir" && (
              <motion.div
                key="fhir"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <FhirExplorerPanel
                  fhirServer={vm.fhirServer}
                  setFhirServer={vm.setFhirServer}
                  fhirMode={vm.fhirMode}
                  setFhirMode={vm.setFhirMode}
                  fhirQuery={vm.fhirQuery}
                  setFhirQuery={vm.setFhirQuery}
                  fhirLoading={vm.fhirLoading}
                  fhirError={vm.fhirError}
                  fhirResults={vm.fhirResults}
                  fhirCount={vm.fhirCount}
                  onSearch={vm.searchFhir}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
