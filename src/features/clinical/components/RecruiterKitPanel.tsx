import { Card } from "@/components/ui/Card";
import { RecruiterKit } from "@/features/clinical/types";

type RecruiterKitPanelProps = {
  kits: RecruiterKit[];
  onLoad: (kit: RecruiterKit, prompt?: string) => void;
  onStartDemo: (kit: RecruiterKit) => void;
  rubricScores: Record<string, Record<number, number>>;
  onSetRubricScore: (kitId: string, criterionIndex: number, score: number) => void;
  onClearRubricScores: (kitId: string) => void;
};

export function RecruiterKitPanel({
  kits,
  onLoad,
  onStartDemo,
  rubricScores,
  onSetRubricScore,
  onClearRubricScores,
}: RecruiterKitPanelProps) {
  const groupedKits = kits.reduce<Record<string, RecruiterKit[]>>((acc, kit) => {
    const key = kit.category || "Uncategorized";
    acc[key] ??= [];
    acc[key].push(kit);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Recruiter Test Kits
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Each kit includes synthetic clinical data and recommended prompts for consistent evaluation. Some kits also include a linked sample file.
        </p>
      </Card>

      {Object.entries(groupedKits).map(([category, categoryKits]) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {category}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {categoryKits.length} synthetic case{categoryKits.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {categoryKits.map((kit) => (
            <Card key={kit.id}>
              {(() => {
                const scoresForKit = rubricScores[kit.id] ?? {};
                const rubricLength = kit.scoringRubric?.length ?? 0;
                const selectedScores = Object.values(scoresForKit).filter(
                  (value) => typeof value === "number"
                );
                const total = selectedScores.reduce((sum, value) => sum + value, 0);
                const average = selectedScores.length > 0 ? total / selectedScores.length : 0;

                return (
                  <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{kit.title}</h3>
                    {kit.noteLengthLabel && (
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300">
                        {kit.noteLengthLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{kit.summary}</p>
                </div>
                {kit.sampleAssetPath && (
                  <a
                    href={kit.sampleAssetPath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {kit.sampleAssetLabel ?? "Open Sample File"}
                  </a>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(kit)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Load In Workbench
                </button>
                <button
                  type="button"
                  onClick={() => onStartDemo(kit)}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-400"
                >
                  Start Guided Demo
                </button>
                {kit.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onLoad(kit, prompt)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Use Prompt: {prompt}
                  </button>
                ))}
              </div>

              {kit.scoringRubric && kit.scoringRubric.length > 0 && (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Recruiter Scoring Rubric (1-5)
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded bg-zinc-200 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        Scored: {selectedScores.length}/{rubricLength}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Avg: {average.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onClearRubricScores(kit.id)}
                        className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Clear Scores
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {kit.scoringRubric.map((criterion, index) => {
                      const selected = scoresForKit[index];

                      return (
                        <div key={criterion} className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950/40">
                          <p className="mb-2 text-xs text-zinc-700 dark:text-zinc-300">{criterion}</p>
                          <div className="flex flex-wrap items-center gap-1">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={`${criterion}-${score}`}
                                type="button"
                                onClick={() => onSetRubricScore(kit.id, index, score)}
                                className={`min-w-8 rounded px-2 py-1 text-xs font-medium ${
                                  selected === score
                                    ? "bg-indigo-600 text-white"
                                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                  </>
                );
              })()}
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
