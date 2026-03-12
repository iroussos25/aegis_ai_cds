import { Card } from "@/components/ui/Card";
import { RecruiterKit } from "@/features/clinical/types";

type RecruiterKitPanelProps = {
  kits: RecruiterKit[];
  onLoad: (kit: RecruiterKit, prompt?: string) => void;
  onStartDemo: (kit: RecruiterKit) => void;
};

export function RecruiterKitPanel({ kits, onLoad, onStartDemo }: RecruiterKitPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Recruiter Test Kits
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Each kit includes synthetic data, a sample PDF, and recommended prompts for consistent evaluation.
        </p>
      </Card>

      {kits.map((kit) => (
        <Card key={kit.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{kit.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{kit.summary}</p>
            </div>
            <a
              href={kit.samplePdfPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Open Sample PDF
            </a>
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
        </Card>
      ))}
    </div>
  );
}
