import { Card } from "@/components/ui/Card";

type DemoGuideProps = {
  demoMode: boolean;
  demoStep: number;
  onAdvance: () => void;
  onExit: () => void;
};

const STEPS = [
  "Load a recruiter test kit from the Recruiter panel.",
  "Run vector indexing from the Workbench.",
  "Submit a suggested prompt and inspect the streamed answer.",
  "Open citations to show grounded evidence chunks.",
];

export function DemoGuide({ demoMode, demoStep, onAdvance, onExit }: DemoGuideProps) {
  if (!demoMode) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900/40">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        Guided Recruiter Demo
      </h2>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">Step {demoStep} of {STEPS.length}</p>
      <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{STEPS[demoStep - 1]}</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-400"
        >
          Next step
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          End demo mode
        </button>
      </div>
    </Card>
  );
}
