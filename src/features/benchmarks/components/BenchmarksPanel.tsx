import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { useBenchmarks } from "@/features/benchmarks/hooks/useBenchmarks";
import { BenchmarkResult } from "@/features/benchmarks/types";

export function BenchmarksPanel() {
  const { state, runBenchmarks, clearResults, exportResults } = useBenchmarks();
  const [runsPerTest, setRunsPerTest] = useState(2);
  const [sortBy, setSortBy] = useState<"latency" | "cost" | "consistency">("latency");

  const handleRunBenchmarks = async () => {
    await runBenchmarks(runsPerTest);
  };

  const sortedResults = [...state.results].sort((a, b) => {
    if (sortBy === "latency") {
      return a.averageLatencyMs - b.averageLatencyMs;
    } else if (sortBy === "cost") {
      return a.totalCostEstimate - b.totalCostEstimate;
    } else {
      const aConsistency =
        a.consistency.length > 0
          ? (a.consistency.reduce((sum: number, c) => sum + (c.semanticConsistency || 0), 0) /
              a.consistency.length) *
            100
          : 0;
      const bConsistency =
        b.consistency.length > 0
          ? (b.consistency.reduce((sum: number, c) => sum + (c.semanticConsistency || 0), 0) /
              b.consistency.length) *
            100
          : 0;
      return bConsistency - aConsistency;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Performance Benchmarks</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Test AI efficiency, latency, cost, and consistency across clinical scenarios and model variants.
        </p>
      </motion.div>

      {/* Control Panel */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">
              Runs per Test Scenario
            </label>
            <select
              value={runsPerTest}
              onChange={(e) => setRunsPerTest(parseInt(e.target.value))}
              disabled={state.isRunning}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 dark:text-zinc-50 disabled:opacity-50"
            >
              <option value={1}>1 run (5 tests = ~1 min)</option>
              <option value={2}>2 runs (10 total = ~2.5 min)</option>
              <option value={3}>3 runs (15 total = ~4 min)</option>
              <option value={5}>5 runs (25 total = ~6.5 min)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRunBenchmarks}
              disabled={state.isRunning}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {state.isRunning ? "Running..." : "Run Benchmarks"}
            </button>
            <button
              onClick={clearResults}
              disabled={state.isRunning || state.results.length === 0}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Progress */}
        {state.isRunning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{state.progressMessage}</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {state.currentTestIndex} / {state.totalTests}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(state.currentTestIndex / state.totalTests) * 100}%` }}
                className="h-full bg-indigo-600"
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Results Summary */}
      <AnimatePresence>
        {state.results.length > 0 && !state.isRunning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Avg Latency",
                  value: Math.round(
                    state.results.reduce((sum: number, r) => sum + r.averageLatencyMs, 0) / state.results.length
                  ),
                  unit: "ms",
                },
                {
                  label: "Total Cost",
                  value: state.results.reduce((sum: number, r) => sum + r.totalCostEstimate, 0).toFixed(4),
                  unit: "$",
                },
                {
                  label: "Avg Time to FTT",
                  value: Math.round(
                    state.results.reduce((sum: number, r) => sum + r.averageTimeToFirstTokenMs, 0) / state.results.length
                  ),
                  unit: "ms",
                },
                {
                  label: "Avg Consistency",
                  value: Math.round(
                    state.results.reduce((sum: number, r) => {
                      const consistency =
                        r.consistency.length > 0
                          ? (r.consistency.reduce((s: number, c) => s + (c.semanticConsistency || 0), 0) /
                              r.consistency.length) *
                            100
                          : 0;
                      return sum + consistency;
                    }, 0) / state.results.length
                  ),
                  unit: "%",
                },
              ].map((stat) => (
                <Card key={stat.label} className="border border-indigo-200 bg-linear-to-br from-indigo-50 to-cyan-50 p-3 dark:border-indigo-800 dark:from-indigo-900/20 dark:to-cyan-900/20">
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{stat.label}</div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {stat.value}
                    <span className="text-sm ml-1">{stat.unit}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => exportResults("json")}
                className="w-full px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportResults("csv")}
                className="w-full px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportResults("pdf")}
                className="w-full px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors"
              >
                Export PDF
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              {["latency", "cost", "consistency"].map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort as typeof sortBy)}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    sortBy === sort
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Sort by {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>

            {/* Results Table */}
            <Card className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Test</th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">
                      Avg Latency
                    </th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">
                      Time to FTT
                    </th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Tokens</th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Cost</th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Citations</th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Consistency</th>
                    <th className="text-right py-2 px-2 font-semibold text-zinc-700 dark:text-zinc-200">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result) => {
                    const avgConsistency =
                      result.consistency.length > 0
                        ? (result.consistency.reduce((sum: number, c) => sum + (c.semanticConsistency || 0), 0) /
                            result.consistency.length) *
                          100
                        : 0;
                    const avgTokens = Math.round(
                      result.runs.reduce((sum: number, m) => sum + m.estimatedTotalTokens, 0) / result.runs.length
                    );

                    return (
                      <tr
                        key={result.testId}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
                      >
                        <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-50">{result.testName}</td>
                        <td className="py-3 px-2 text-right text-zinc-600 dark:text-zinc-300">
                          {result.averageLatencyMs}ms
                        </td>
                        <td className="py-3 px-2 text-right text-zinc-600 dark:text-zinc-300">
                          {result.averageTimeToFirstTokenMs}ms
                        </td>
                        <td className="py-3 px-2 text-right text-zinc-600 dark:text-zinc-300">{avgTokens}</td>
                        <td className="py-3 px-2 text-right text-zinc-600 dark:text-zinc-300">
                          ${result.totalCostEstimate.toFixed(5)}
                        </td>
                        <td className="py-3 px-2 text-right text-zinc-600 dark:text-zinc-300">
                          {result.averageCitationsPerRun}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <ProgressBar value={avgConsistency} />
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            {result.successRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Detailed Results */}
            <div className="space-y-3">
              {sortedResults.map((result) => (
                <ResultDetail key={result.testId} result={result} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {state.results.length === 0 && !state.isRunning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-zinc-500 dark:text-zinc-400"
        >
          <p className="text-sm">Run benchmarks to see performance metrics and analysis results.</p>
        </motion.div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-indigo-500 to-cyan-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-8 text-right">{Math.round(value)}%</span>
    </div>
  );
}

function ResultDetail({ result }: { result: BenchmarkResult }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const avgConsistency =
    result.consistency.length > 0
      ? (result.consistency.reduce((sum, c) => sum + (c.semanticConsistency || 0), 0) / result.consistency.length) *
        100
      : 0;

  return (
    <div
      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <Card className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{result.testName}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {result.runs.length} run{result.runs.length !== 1 ? "s" : ""} • {result.successRate}% success •{" "}
              {Object.keys(result.modelUsageSummary).join(", ")}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {result.averageLatencyMs}ms latency
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">${result.totalCostEstimate.toFixed(5)}</div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3"
            >
              {/* Model Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mb-2">Models Used</h4>
                <div className="space-y-1">
                  {Object.entries(result.modelUsageSummary).map(([model, stats]) => (
                    <div key={model} className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                      <span>{model}:</span>
                      <span>
                        {stats.count} run{stats.count !== 1 ? "s" : ""} • {stats.avgLatency}ms • {stats.successRate}% success
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consistency */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mb-2">Consistency Score</h4>
                <ProgressBar value={avgConsistency} />
              </div>

              {/* Run Details */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mb-2">Run Details</h4>
                <div className="space-y-2 text-xs">
                  {result.runs.map((run, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 p-2 bg-zinc-50 dark:bg-zinc-900/30 rounded">
                      <div>
                        Run {idx + 1}: {run.latencyMs}ms
                        {!run.success && run.errorMessage ? (
                          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{run.errorMessage}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        {run.success ? (
                          <span className="text-green-600 dark:text-green-400">✓ Success</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">✗ Failed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
