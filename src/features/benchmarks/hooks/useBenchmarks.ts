import { useCallback, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getClientApiHeaders, readApiErrorMessage } from "@/lib/client/api";
import { BenchmarkMetrics, BenchmarkResult, BenchmarkState, ConsistencyRun } from "../types";
import { BENCHMARK_SCENARIOS } from "../scenarios";

const COST_PER_1M_INPUT_TOKENS = 0.005; // Rough estimate for Gemini models
const COST_PER_1M_OUTPUT_TOKENS = 0.015;

function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

function computeStringHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function countEvidenceCitations(response: string): number {
  // Count [chunk N | ...] patterns in the response
  const citationMatches = response.match(/\[chunk\s+\d+/g);
  return citationMatches?.length ?? 0;
}

export function useBenchmarks() {
  const [state, setState] = useState<BenchmarkState>({
    results: [],
    isRunning: false,
    currentTestIndex: 0,
    totalTests: 0,
    progressMessage: "",
  });

  const runBenchmarks = useCallback(
    async (runsPerTest: number = 2) => {
      setState({
        results: [],
        isRunning: true,
        currentTestIndex: 0,
        totalTests: BENCHMARK_SCENARIOS.length,
        progressMessage: "Initializing benchmarks...",
      });

      const allResults: BenchmarkResult[] = [];

      for (let testIdx = 0; testIdx < BENCHMARK_SCENARIOS.length; testIdx++) {
        const scenario = BENCHMARK_SCENARIOS[testIdx];

        setState((prev) => ({
          ...prev,
          currentTestIndex: testIdx + 1,
          progressMessage: `Running ${scenario.name}... (${runsPerTest} runs)`,
        }));

        const metrics: BenchmarkMetrics[] = [];
        const consistencyRuns: ConsistencyRun[] = [];

        for (let run = 0; run < runsPerTest; run++) {
          try {
            const startTime = performance.now();
            let timeToFirstToken = 0;
            let firstTokenReceived = false;

            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: getClientApiHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({
                prompt: scenario.question,
                context: scenario.context,
              }),
            });

            if (!res.ok) {
              throw new Error(await readApiErrorMessage(res, `API error: ${res.status}`));
            }

            let responseText = "";
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (!firstTokenReceived) {
                  timeToFirstToken = performance.now() - startTime;
                  firstTokenReceived = true;
                }

                const chunk = decoder.decode(value, { stream: true });
                responseText += chunk;
              }

              const finalChunk = decoder.decode();
              if (finalChunk) {
                responseText += finalChunk;
              }
            }

            const endTime = performance.now();
            const totalLatency = endTime - startTime;

            const completionTokens = estimateTokenCount(responseText);
            const inputTokens = estimateTokenCount(scenario.question + scenario.context);
            const totalTokens = inputTokens + completionTokens;
            const cost =
              (inputTokens * COST_PER_1M_INPUT_TOKENS + completionTokens * COST_PER_1M_OUTPUT_TOKENS) / 1000000;

            const metric: BenchmarkMetrics = {
              testId: scenario.id,
              testName: scenario.name,
              model: res.headers.get("X-Model-Used") || "unknown",
              latencyMs: Math.round(totalLatency),
              timeToFirstTokenMs: Math.round(timeToFirstToken),
              completionTokens,
              estimatedInputTokens: inputTokens,
              estimatedTotalTokens: totalTokens,
              estimatedCost: cost,
              evidenceCitationsCount: countEvidenceCitations(responseText),
              responseLength: responseText.length,
              timestamp: new Date().toISOString(),
              success: true,
            };

            metrics.push(metric);

            // Track for consistency analysis
            const responseHash = computeStringHash(responseText);
            consistencyRuns.push({
              runNumber: run + 1,
              responseHash,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";

            const metric: BenchmarkMetrics = {
              testId: scenario.id,
              testName: scenario.name,
              model: "unknown",
              latencyMs: 0,
              timeToFirstTokenMs: 0,
              completionTokens: 0,
              estimatedInputTokens: 0,
              estimatedTotalTokens: 0,
              estimatedCost: 0,
              evidenceCitationsCount: 0,
              responseLength: 0,
              timestamp: new Date().toISOString(),
              success: false,
              errorMessage: errorMsg,
            };

            metrics.push(metric);
          }

          // Small delay between runs
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Calculate consistency score: percentage of runs with same hash
        const hashes = consistencyRuns.map((r) => r.responseHash);
        const mostCommonHash = hashes[0];
        const consistencyScore =
          hashes.length > 0 ? (hashes.filter((h) => h === mostCommonHash).length / hashes.length) * 100 : 0;

        consistencyRuns.forEach((r) => {
          r.semanticConsistency = consistencyScore / 100;
        });

        // Aggregate results
        const successfulMetrics = metrics.filter((m) => m.success);
        const modelUsageSummary: Record<string, { count: number; avgLatency: number; successRate: number }> = {};

        for (const metric of metrics) {
          if (!modelUsageSummary[metric.model]) {
            modelUsageSummary[metric.model] = { count: 0, avgLatency: 0, successRate: 0 };
          }
          modelUsageSummary[metric.model].count++;
          modelUsageSummary[metric.model].avgLatency += metric.latencyMs;
          if (metric.success) {
            modelUsageSummary[metric.model].successRate++;
          }
        }

        for (const model in modelUsageSummary) {
          const usage = modelUsageSummary[model];
          usage.avgLatency = Math.round(usage.avgLatency / usage.count);
          usage.successRate = Math.round((usage.successRate / usage.count) * 100);
        }

        const result: BenchmarkResult = {
          testId: scenario.id,
          testName: scenario.name,
          runs: metrics,
          consistency: consistencyRuns,
          averageLatencyMs:
            successfulMetrics.length > 0
              ? Math.round(successfulMetrics.reduce((sum, m) => sum + m.latencyMs, 0) / successfulMetrics.length)
              : 0,
          averageTimeToFirstTokenMs:
            successfulMetrics.length > 0
              ? Math.round(
                  successfulMetrics.reduce((sum, m) => sum + m.timeToFirstTokenMs, 0) / successfulMetrics.length
                )
              : 0,
          successRate: Math.round((successfulMetrics.length / metrics.length) * 100),
          averageCitationsPerRun:
            successfulMetrics.length > 0
              ? Math.round(successfulMetrics.reduce((sum, m) => sum + m.evidenceCitationsCount, 0))
              : 0,
          totalCostEstimate: metrics.reduce((sum, m) => sum + m.estimatedCost, 0),
          modelUsageSummary,
        };

        allResults.push(result);

        setState((prev) => ({
          ...prev,
          results: allResults,
        }));
      }

      setState((prev) => ({
        ...prev,
        isRunning: false,
        progressMessage: "Benchmarks complete!",
      }));
    },
    []
  );

  const clearResults = useCallback(() => {
    setState({
      results: [],
      isRunning: false,
      currentTestIndex: 0,
      totalTests: 0,
      progressMessage: "",
    });
  }, []);

  const exportResults = useCallback(async (format: "json" | "csv" | "pdf" = "json") => {
    if (state.results.length === 0) {
      alert("No results to export");
      return;
    }

    if (format === "json") {
      const dataStr = JSON.stringify(state.results, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `benchmarks-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === "csv") {
      // Flatten results into CSV
      const rows: string[] = [
        "Test Name,Model,Latency (ms),Time To First Token (ms),Completion Tokens,Total Tokens,Estimated Cost ($),Evidence Citations,Response Length,Success Rate,Consistency Score",
      ];

      for (const result of state.results) {
        const row = [
          result.testName,
          Object.keys(result.modelUsageSummary).join("|"),
          result.averageLatencyMs,
          result.averageTimeToFirstTokenMs,
          Math.round(result.runs.reduce((sum, m) => sum + m.completionTokens, 0) / result.runs.length),
          Math.round(result.runs.reduce((sum, m) => sum + m.estimatedTotalTokens, 0) / result.runs.length),
          result.totalCostEstimate.toFixed(6),
          result.averageCitationsPerRun,
          Math.round(result.runs.reduce((sum, m) => sum + m.responseLength, 0) / result.runs.length),
          result.successRate,
          (
            (result.consistency.reduce((sum, c) => sum + (c.semanticConsistency || 0), 0) / result.consistency.length) *
            100
          ).toFixed(1),
        ];
        rows.push(row.map((cell) => `"${cell}"`).join(","));
      }

      const dataStr = rows.join("\n");
      const dataBlob = new Blob([dataStr], { type: "text/csv" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `benchmarks-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageWidth = 612;
      const pageHeight = 792;
      const marginX = 40;
      const topY = pageHeight - 40;
      const bottomY = 40;
      const lineHeight = 14;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = topY;

      const ensureSpace = (heightNeeded: number) => {
        if (y - heightNeeded < bottomY) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = topY;
        }
      };

      const drawText = (
        text: string,
        x: number,
        textY: number,
        size = 10,
        isBold = false,
        color = rgb(0.12, 0.12, 0.12)
      ) => {
        page.drawText(text, {
          x,
          y: textY,
          size,
          font: isBold ? titleFont : font,
          color,
        });
      };

      const drawWrappedText = (text: string, x: number, maxWidth: number, size = 10, isBold = false) => {
        const words = text.split(" ");
        let currentLine = "";
        const lines: string[] = [];

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const width = (isBold ? titleFont : font).widthOfTextAtSize(testLine, size);
          if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        ensureSpace(lines.length * lineHeight + 6);
        for (const line of lines) {
          drawText(line, x, y, size, isBold);
          y -= lineHeight;
        }
      };

      const sortedResults = [...state.results].sort((a, b) => a.averageLatencyMs - b.averageLatencyMs);

      const avgLatency = Math.round(
        state.results.reduce((sum, r) => sum + r.averageLatencyMs, 0) / state.results.length
      );
      const totalCost = state.results.reduce((sum, r) => sum + r.totalCostEstimate, 0);
      const avgTtft = Math.round(
        state.results.reduce((sum, r) => sum + r.averageTimeToFirstTokenMs, 0) / state.results.length
      );
      const avgConsistency = Math.round(
        state.results.reduce((sum, r) => {
          const consistency =
            r.consistency.length > 0
              ? (r.consistency.reduce((innerSum, c) => innerSum + (c.semanticConsistency || 0), 0) /
                  r.consistency.length) *
                100
              : 0;
          return sum + consistency;
        }, 0) / state.results.length
      );

      drawText("Aegis AI - Performance Benchmarks", marginX, y, 18, true, rgb(0.15, 0.2, 0.45));
      y -= 20;
      drawText("Completed benchmark output export", marginX, y, 10, false, rgb(0.35, 0.35, 0.35));
      y -= 14;
      drawText(`Generated: ${new Date().toLocaleString()}`, marginX, y, 9, false, rgb(0.35, 0.35, 0.35));
      y -= 22;

      ensureSpace(110);
      drawText("Summary Stats", marginX, y, 12, true);
      y -= 12;

      const cards = [
        { label: "Avg Latency", value: `${avgLatency} ms` },
        { label: "Total Cost", value: `$${totalCost.toFixed(4)}` },
        { label: "Avg Time to FTT", value: `${avgTtft} ms` },
        { label: "Avg Consistency", value: `${avgConsistency}%` },
      ];

      const cardWidth = (pageWidth - marginX * 2 - 12) / 2;
      const cardHeight = 38;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = marginX + col * (cardWidth + 12);
        const cardY = y - row * (cardHeight + 8);
        page.drawRectangle({
          x,
          y: cardY - cardHeight,
          width: cardWidth,
          height: cardHeight,
          color: rgb(0.96, 0.97, 1),
          borderColor: rgb(0.85, 0.88, 0.97),
          borderWidth: 1,
        });
        drawText(card.label, x + 8, cardY - 14, 9, false, rgb(0.35, 0.35, 0.35));
        drawText(card.value, x + 8, cardY - 28, 12, true, rgb(0.14, 0.22, 0.52));
      }
      y -= cardHeight * 2 + 24;

      ensureSpace(140);
      drawText("Results Table", marginX, y, 12, true);
      y -= 12;

      const columns = [
        { title: "Test", width: 190 },
        { title: "Latency", width: 60 },
        { title: "FTT", width: 48 },
        { title: "Tokens", width: 55 },
        { title: "Cost", width: 58 },
        { title: "Cite", width: 40 },
        { title: "Cons", width: 44 },
        { title: "OK", width: 35 },
      ];

      const rowHeight = 16;
      let tableX = marginX;
      page.drawRectangle({
        x: marginX,
        y: y - rowHeight,
        width: pageWidth - marginX * 2,
        height: rowHeight,
        color: rgb(0.12, 0.16, 0.3),
      });

      for (const col of columns) {
        drawText(col.title, tableX + 4, y - 11, 8, true, rgb(1, 1, 1));
        tableX += col.width;
      }
      y -= rowHeight;

      for (const result of sortedResults) {
        ensureSpace(rowHeight + 2);

        const consistency =
          result.consistency.length > 0
            ? (result.consistency.reduce((sum, c) => sum + (c.semanticConsistency || 0), 0) / result.consistency.length) *
              100
            : 0;
        const avgTokens = Math.round(
          result.runs.reduce((sum, metric) => sum + metric.estimatedTotalTokens, 0) / result.runs.length
        );

        page.drawRectangle({
          x: marginX,
          y: y - rowHeight,
          width: pageWidth - marginX * 2,
          height: rowHeight,
          color: rgb(0.985, 0.987, 0.995),
          borderColor: rgb(0.9, 0.92, 0.96),
          borderWidth: 0.6,
        });

        const rowValues = [
          result.testName.length > 28 ? `${result.testName.slice(0, 28)}...` : result.testName,
          `${result.averageLatencyMs}ms`,
          `${result.averageTimeToFirstTokenMs}ms`,
          `${avgTokens}`,
          `$${result.totalCostEstimate.toFixed(5)}`,
          `${result.averageCitationsPerRun}`,
          `${Math.round(consistency)}%`,
          `${result.successRate}%`,
        ];

        tableX = marginX;
        for (let i = 0; i < columns.length; i++) {
          drawText(rowValues[i], tableX + 4, y - 11, 8, false);
          tableX += columns[i].width;
        }

        y -= rowHeight;
      }

      y -= 12;
      for (const result of sortedResults) {
        const sectionMinHeight = 88 + result.runs.length * 14;
        ensureSpace(sectionMinHeight);

        page.drawRectangle({
          x: marginX,
          y: y - sectionMinHeight + 10,
          width: pageWidth - marginX * 2,
          height: sectionMinHeight,
          color: rgb(0.99, 0.99, 1),
          borderColor: rgb(0.88, 0.9, 0.95),
          borderWidth: 1,
        });

        drawWrappedText(result.testName, marginX + 10, pageWidth - marginX * 2 - 20, 11, true);
        drawText(
          `${result.runs.length} run${result.runs.length === 1 ? "" : "s"} | ${result.successRate}% success | ${Object.keys(
            result.modelUsageSummary
          ).join(", ")}`,
          marginX + 10,
          y,
          9,
          false,
          rgb(0.35, 0.35, 0.35)
        );
        y -= lineHeight;
        drawText(
          `Latency ${result.averageLatencyMs}ms | Cost $${result.totalCostEstimate.toFixed(5)} | Time to FTT ${result.averageTimeToFirstTokenMs}ms`,
          marginX + 10,
          y,
          9
        );
        y -= lineHeight;

        drawText("Models Used", marginX + 10, y, 9, true);
        y -= lineHeight;
        for (const [model, stats] of Object.entries(result.modelUsageSummary)) {
          drawWrappedText(
            `${model}: ${stats.count} run${stats.count === 1 ? "" : "s"} | ${stats.avgLatency}ms | ${stats.successRate}% success`,
            marginX + 14,
            pageWidth - marginX * 2 - 28,
            8
          );
        }

        drawText("Run Details", marginX + 10, y, 9, true);
        y -= lineHeight;
        result.runs.forEach((run, index) => {
          const runStatus = run.success ? "Success" : "Failed";
          const message = run.errorMessage ? ` | ${run.errorMessage}` : "";
          drawWrappedText(
            `Run ${index + 1}: ${run.latencyMs}ms | ${runStatus}${message}`,
            marginX + 14,
            pageWidth - marginX * 2 - 28,
            8
          );
        });

        y -= 8;
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBinary = new Uint8Array(pdfBytes.length);
      pdfBinary.set(pdfBytes);
      const dataBlob = new Blob([pdfBinary], { type: "application/pdf" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `benchmarks-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [state.results]);

  return {
    state,
    runBenchmarks,
    clearResults,
    exportResults,
  };
}
